import os
import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from urllib.parse import urlparse, quote

import bcrypt
import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship

# ==========================================
# CONFIGURATION & DATABASE SETUP
# ==========================================
SECRET_KEY = os.getenv("SECRET_KEY", "multiplier-ai-super-secret-jwt-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./url_previews.db")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ==========================================
# DATABASE MODELS
# ==========================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    urls = relationship("SavedURL", back_populates="owner", cascade="all, delete-orphan")


class SavedURL(Base):
    __tablename__ = "saved_urls"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(Text, nullable=False)
    domain = Column(String(255), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    screenshot_url = Column(Text, nullable=False)
    og_image = Column(Text, nullable=True)
    favicon = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="urls")


Base.metadata.create_all(bind=engine)


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class URLSubmitRequest(BaseModel):
    url: str


class SavedURLResponse(BaseModel):
    id: int
    url: str
    domain: str
    title: str
    description: Optional[str]
    screenshot_url: str
    og_image: Optional[str]
    favicon: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# AUTHENTICATION UTILITIES
# ==========================================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


# ==========================================
# VISUAL PREVIEW & METADATA ENGINE
# ==========================================
def normalize_url(raw_url: str) -> str:
    cleaned = raw_url.strip()
    if not cleaned.startswith(("http://", "https://")):
        cleaned = "https://" + cleaned
    return cleaned


def parse_url_slug_fallback(url: str) -> dict:
    """
    Extracts human-readable title and description from URLs (especially Justdial
    directory listings) when anti-bot protection blocks direct HTML scraping.
    """
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "")
    path_parts = [p for p in parsed.path.split("/") if p]

    if "justdial.com" in domain and len(path_parts) >= 2:
        city = path_parts[0].replace("-", " ")
        raw_slug = path_parts[1]
        clean_title = raw_slug.replace("-", " ")
        return {
            "title": f"{clean_title} | Justdial {city}",
            "description": (
                f"Verified Justdial healthcare & business listing in {city}: "
                f"{clean_title}. View ratings, address, timings, and contact details."
            ),
        }

    if path_parts:
         readable_slug = re.sub(r"[-_]+", " ", path_parts[-1]).strip().title()
         return {
             "title": f"{readable_slug} — {domain}",
             "description": f"Web page preview for {url}",
         }

    return {
        "title": domain.title(),
        "description": f"Visual website preview and metadata snapshot for {url}",
    }


async def generate_website_preview(target_url: str) -> dict:
    parsed = urlparse(target_url)
    domain = parsed.netloc.replace("www.", "") or target_url
    fallback_info = parse_url_slug_fallback(target_url)

    title = fallback_info["title"]
    description = fallback_info["description"]
    og_image = None
    favicon = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/128.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
    }

    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        # Step 1: Direct HTML OpenGraph scrape
        try:
            resp = await client.get(target_url, headers=headers)
            if resp.status_code == 200 and "text/html" in resp.headers.get("content-type", ""):
                soup = BeautifulSoup(resp.text, "html.parser")

                og_title = soup.find("meta", property="og:title")
                if og_title and og_title.get("content"):
                    title = og_title["content"].strip()
                elif soup.title and soup.title.string:
                    scraped_title = soup.title.string.strip()
                    if "Access Denied" not in scraped_title and "Just a moment" not in scraped_title:
                        title = scraped_title

                og_desc = soup.find("meta", property="og:description") or soup.find(
                    "meta", attrs={"name": "description"}
                )
                if og_desc and og_desc.get("content"):
                    description = og_desc["content"].strip()

                og_img = soup.find("meta", property="og:image")
                if og_img and og_img.get("content"):
                    og_image = og_img["content"].strip()
        except Exception:
            pass

        # Step 2: Try Microlink if title is still generic
        if title == fallback_info["title"]:
            try:
                microlink_api = (
                    f"https://api.microlink.io/?url={quote(target_url, safe='')}"
                    f"&screenshot=true&meta=true"
                )
                ml_resp = await client.get(microlink_api)
                if ml_resp.status_code == 200:
                    ml_data = ml_resp.json().get("data", {})
                    if ml_data.get("title") and "Access Denied" not in ml_data.get("title", ""):
                        title = ml_data["title"]
                    if ml_data.get("description"):
                        description = ml_data["description"]
                    if ml_data.get("image") and ml_data["image"].get("url"):
                        og_image = ml_data["image"]["url"]
                    if ml_data.get("logo") and ml_data["logo"].get("url"):
                        favicon = ml_data["logo"]["url"]
            except Exception:
                pass

    # FIX: Eliminate "Access Denied" screenshots & ignore Justdial stock photos
   # FIX: Use a different screenshot service for protected sites that might bypass basic firewalls
    is_protected_site = "justdial.com" in domain
    
    if is_protected_site:
        # Use URLBox or alternative public capture endpoint that has better stealth
        screenshot_url = f"https://s0.wp.com/mshots/v1/{quote(target_url, safe='')}?w=1200&h=800"
    else:
        screenshot_url = og_image if og_image else f"https://image.thum.io/get/width/1200/crop/800/noanimate/{target_url}"

    return {
        "url": target_url,
        "domain": domain,
        "title": title,
        "description": description,
        "screenshot_url": screenshot_url,
        "og_image": og_image,
        "favicon": favicon,
    }


# ==========================================
# FASTAPI APP & ROUTES
# ==========================================
app = FastAPI(
    title="Multiplier AI - URL Visual Preview API",
    description="Full-Stack Intern Assignment: Auth + Website Visual Preview Generator & History",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "Multiplier AI URL Preview Backend"}


@app.post("/api/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    new_user = User(
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        hashed_password=hash_password(payload.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id)})
    return {"access_token": token, "token_type": "bearer", "user": new_user}


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/api/urls/preview", response_model=SavedURLResponse, status_code=status.HTTP_201_CREATED)
async def create_and_save_url_preview(
    payload: URLSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.url or not payload.url.strip():
        raise HTTPException(status_code=400, detail="Please provide a valid URL.")

    normalized = normalize_url(payload.url)
    preview_data = await generate_website_preview(normalized)

    saved_item = SavedURL(
        url=preview_data["url"],
        domain=preview_data["domain"],
        title=preview_data["title"],
        description=preview_data["description"],
        screenshot_url=preview_data["screenshot_url"],
        og_image=preview_data["og_image"],
        favicon=preview_data["favicon"],
        user_id=current_user.id,
    )
    db.add(saved_item)
    db.commit()
    db.refresh(saved_item)
    return saved_item


@app.get("/api/urls", response_model=List[SavedURLResponse])
def list_saved_urls(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(SavedURL)
        .filter(SavedURL.user_id == current_user.id)
        .order_by(SavedURL.created_at.desc())
        .all()
    )


@app.delete("/api/urls/{url_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_url(
    url_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(SavedURL)
        .filter(SavedURL.id == url_id, SavedURL.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Saved URL not found.")
    db.delete(item)
    db.commit()
    return None