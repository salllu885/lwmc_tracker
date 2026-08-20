import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import loginBg from '../assets/login-bg.jpg';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <img src={loginBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/55 to-slate-950/85" />
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-900/30 via-transparent to-transparent" />

      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg shrink-0">
            <GopBadge />
          </div>
          <div className="text-left">
            <div className="text-white font-bold text-sm leading-tight tracking-wide">GOVERNMENT OF PUNJAB</div>
            <div className="text-amber-300 font-semibold text-xs tracking-widest uppercase">Suthra Punjab</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur rounded-2xl border border-white/20 p-6 w-full space-y-4 shadow-2xl">
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-900">Field Issue Tracker</h1>
            <p className="text-xs text-slate-400">Sign in to continue</p>
          </div>
          {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            disabled={submitting}
            type="submit"
            className="w-full rounded-xl bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-3 text-sm hover:bg-slate-800 transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-[11px] text-white/60">Lahore District Field Force Management</p>
      </div>
    </div>
  );
}

// Text-based Punjab government badge — no official emblem file was
// available to embed, so this is a plain circular wordmark rather than an
// attempt to redraw the actual crest. Swap in a real logo image (e.g.
// src/assets/gop-logo.png, imported like login-bg.jpg above) when one's on
// hand for pixel-accurate branding.
function GopBadge() {
  return (
    <div className="w-11 h-11 rounded-full border-2 border-emerald-700 flex items-center justify-center">
      <span className="text-emerald-700 font-black text-[10px] leading-none text-center">
        GoP
      </span>
    </div>
  );
}
