import React, { useState, useEffect } from 'react';
import {
  Globe,
  LogIn,
  UserPlus,
  LogOut,
  ExternalLink,
  Trash2,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  LayoutGrid,
  Monitor,
  Search
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const JUSTDIAL_TEST_URL =
  'https://www.justdial.com/Hyderabad/Dr-Sarita-Rao-Tx-Hospitals-Near-Masjid-Uppal-Bus-Stand-Bharath-Nagar-Colony-Uppal/040PXX40-XX40-231215200040-Y2E1_BZDET';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  // Auth State
  const [isLoginView, setIsLoginView] = useState(true);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // URL Preview State
  const [urlInput, setUrlInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedUrls, setSavedUrls] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activePreview, setActivePreview] = useState(null);
  const [previewMode, setPreviewMode] = useState('iframe');
  const [imgFallback, setImgFallback] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (token) {
      fetchSavedUrls();
    }
  }, [token]);

  useEffect(() => {
    setImgFallback(false);
    setPreviewMode('snapshot');
  }, [activePreview?.id]);

  const fetchSavedUrls = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/urls`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setSavedUrls(data);
        if (data.length > 0 && !activePreview) {
          setActivePreview(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch URLs:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = isLoginView ? '/api/auth/login' : '/api/auth/signup';
    const payload = isLoginView
      ? { email: authForm.email, password: authForm.password }
      : authForm;

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setSavedUrls([]);
    setActivePreview(null);
  };

  const handleUrlSubmit = async (e, customUrl = null) => {
    if (e) e.preventDefault();
    const target = customUrl || urlInput;
    if (!target.trim()) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/urls/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: target }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to generate website preview');
      }

      setSavedUrls((prev) => [data, ...prev]);
      setActivePreview(data);
      setUrlInput('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUrl = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE_URL}/api/urls/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const updated = savedUrls.filter((item) => item.id !== id);
        setSavedUrls(updated);
        if (activePreview?.id === id) {
          setActivePreview(updated[0] || null);
        }
      }
    } catch (err) {
      console.error('Failed to delete URL:', err);
    }
  };

  const filteredUrls = savedUrls.filter(
    (item) =>
      item.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.url.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.domain.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // ==========================================
  // RENDER: AUTHENTICATION VIEW (SIGNUP / LOGIN)
  // ==========================================
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Globe className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Multiplier AI
              </h1>
              <p className="text-xs text-slate-400">
                Website Visual Preview & Archiver
              </p>
            </div>
          </div>

          {/* Toggle Tabs */}
          <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsLoginView(true);
                setAuthError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition ${
                isLoginView
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-4 h-4" /> Login
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLoginView(false);
                setAuthError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition ${
                !isLoginView
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Sign Up
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {!isLoginView && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Vaibhav Khandelwal"
                  value={authForm.name}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={authForm.email}
                onChange={(e) =>
                  setAuthForm({ ...authForm, email: e.target.value })
                }
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm({ ...authForm, password: e.target.value })
                }
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLoginView ? (
                'Sign In to Dashboard'
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: AUTHENTICATED DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                Multiplier AI — URL Preview Studio
              </h1>
              <p className="text-xs text-slate-400">
                Capture, preview, and archive website snapshots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8 flex-1">
        {/* URL Submission Card */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Submit a Website URL for Visual Preview
              </h2>
              <p className="text-xs text-slate-400">
                Enter any URL below to generate a live visual snapshot and save it to your collection.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUrlInput(JUSTDIAL_TEST_URL);
                handleUrlSubmit(null, JUSTDIAL_TEST_URL);
              }}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition self-start"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Test with Justdial Dr. Sarita Rao URL
            </button>
          </div>

          <form onSubmit={(e) => handleUrlSubmit(e)} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="https://www.justdial.com/Hyderabad/Dr-Sarita-Rao-Tx-Hospitals..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 shrink-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Preview...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Preview & Save URL
                </>
              )}
            </button>
          </form>

          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </section>

        {/* Active Visual Preview Stage */}
        {activePreview && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Browser Mockup Top Bar */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Active Visual Preview
                </span>
              </div>

              <div className="flex-1 max-w-xl mx-auto px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 truncate flex items-center gap-2">
                {activePreview.favicon && (
                  <img
                    src={activePreview.favicon}
                    alt="icon"
                    className="w-4 h-4 rounded"
                  />
                )}
                <span className="truncate">{activePreview.url}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewMode('snapshot')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    previewMode === 'snapshot'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Visual Snapshot
                </button>
                <button
                  onClick={() => setPreviewMode('iframe')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    previewMode === 'iframe'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Live Embed
                </button>
                <a
                  href={activePreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-indigo-300 transition"
                >
                  Open Site <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Preview Content Body */}
            <div className="grid grid-cols-1 lg:grid-cols-3">
              {/* Left 2 Columns: Visual Preview */}
              <div className="lg:col-span-2 bg-slate-950 min-h-[380px] flex items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
                {previewMode === 'snapshot' ? (
                  !imgFallback ? (
                    <img
                      src={activePreview.screenshot_url}
                      alt={activePreview.title}
                      onError={() => setImgFallback(true)}
                      className="w-full h-[420px] object-cover object-top"
                    />
                  ) : (
                    <div className="p-8 text-center max-w-lg">
                      <Monitor className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-white mb-2">
                        {activePreview.title}
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">
                        {activePreview.description}
                      </p>
                      <a
                        href={activePreview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                      >
                        Launch Live Page <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )
                ) : (
                  <div className="w-full h-[420px] flex flex-col">
                    <iframe
                      src={activePreview.url}
                      title={activePreview.title}
                      className="w-full flex-1 bg-white"
                      sandbox="allow-scripts allow-same-origin"
                    />
                    <div className="bg-slate-900 px-4 py-2 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>
                        Note: Sites like Justdial set X-Frame-Options: SAMEORIGIN. Use "Visual Snapshot" tab if blocked by host.
                      </span>
                      <button
                        onClick={() => setPreviewMode('snapshot')}
                        className="text-indigo-400 underline ml-2"
                      >
                        Switch to Visual Snapshot
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Extracted Metadata Details */}
              <div className="p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {activePreview.favicon && (
                      <img
                        src={activePreview.favicon}
                        alt=""
                        className="w-5 h-5 rounded"
                      />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                      {activePreview.domain}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white leading-snug">
                    {activePreview.title}
                  </h3>

                  <p className="text-sm text-slate-300 leading-relaxed">
                    {activePreview.description}
                  </p>

                  <div className="pt-2 border-t border-slate-800 space-y-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Saved on{' '}
                        {new Date(activePreview.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="break-all text-slate-500">
                      <strong className="text-slate-400">Target URL:</strong>{' '}
                      {activePreview.url}
                    </div>
                  </div>
                </div>

                <a
                  href={activePreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  Visit Original Website <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Previously Saved URLs & Previews Gallery */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">
                Previously Saved URLs & Previews ({savedUrls.length})
              </h2>
            </div>

            {savedUrls.length > 0 && (
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter saved previews..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {loadingHistory ? (
            <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span>Loading saved URL previews...</span>
            </div>
          ) : filteredUrls.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
              <Globe className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-300">
                No saved website previews yet
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Submit any URL above or click the Justdial Test URL button to generate your first visual preview.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUrls.map((item) => {
                const isSelected = activePreview?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActivePreview(item)}
                    className={`group cursor-pointer bg-slate-900 rounded-2xl overflow-hidden border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Thumbnail Visual Preview */}
                      <div className="h-44 bg-slate-950 relative overflow-hidden border-b border-slate-800">
                        <img
                          src={item.screenshot_url}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur border border-slate-800 text-[11px] font-medium text-slate-200 flex items-center gap-1.5">
                          {item.favicon && (
                            <img
                              src={item.favicon}
                              alt=""
                              className="w-3.5 h-3.5 rounded"
                            />
                          )}
                          <span>{item.domain}</span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4">
                        <h3 className="text-sm font-bold text-white line-clamp-2 mb-1.5">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                          {item.description}
                        </p>
                        <p className="text-[11px] text-indigo-400 truncate">
                          {item.url}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title="Open Website"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={(e) => handleDeleteUrl(item.id, e)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                          title="Delete Preview"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}