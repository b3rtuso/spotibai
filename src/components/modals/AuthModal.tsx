import React, { useState } from 'react';
import { X, Music, Mail, Lock, User as UserIcon, Sparkles, Check, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authMode, closeAuthModal, login, signup } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>(authMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync mode when store changes
  React.useEffect(() => {
    setMode(authMode);
    setError(null);
  }, [authMode, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(cleanEmail, password);
      } else {
        await signup(cleanEmail, password, name.trim() || undefined);
      }
      closeAuthModal();
      setEmail('');
      setPassword('');
      setName('');
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setIsLoading(true);
    try {
      await login('premium.user@spotibai.app', 'spotibai123', 'Spotibai Premium');
      closeAuthModal();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-spotify-green/20 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-spotify-green flex items-center justify-center text-black shadow-lg shadow-spotify-green/25 mb-3">
            <Music className="w-6 h-6 fill-black stroke-black" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {mode === 'login' ? 'Log in to Spotibai' : 'Create Free Account'}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Unlimited music streaming, AI karaoke stems & background playback.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-black/40 p-1 rounded-xl mb-5 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-spotify-green text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-spotify-green text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                Your Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-spotify-green transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-spotify-green transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-spotify-green transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-full bg-spotify-green hover:bg-[#1ed760] text-black font-bold text-xs tracking-wide uppercase transition-all duration-150 cursor-pointer shadow-lg shadow-spotify-green/20 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative px-3 bg-neutral-900 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            or instant access
          </span>
        </div>

        {/* Quick Demo Login Button */}
        <button
          type="button"
          onClick={handleQuickDemoLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
        >
          <Sparkles className="w-3.5 h-3.5 text-spotify-green" />
          <span>Continue with Spotibai Premium</span>
          <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      </div>
    </div>
  );
};
