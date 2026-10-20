import React from 'react';
import { ChevronLeft, ChevronRight, User, Keyboard, Music, LogIn } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { AccountDropdown } from './AccountDropdown';

export const TopBar: React.FC = () => {
  const {
    setActiveView,
    toggleShortcuts,
    goBack,
    goForward,
    viewHistory,
    viewHistoryIndex,
  } = useUiStore();

  const { isAuthenticated, user, toggleAccountMenu, openAuthModal } = useAuthStore();

  const canGoBack = viewHistoryIndex > 0;
  const canGoForward = viewHistoryIndex < viewHistory.length - 1;

  return (
    <header className="h-14 sm:h-16 px-4 md:px-8 flex items-center justify-between z-40 select-none bg-black/40 backdrop-blur-md border-b border-white/5 sticky top-0 flex-shrink-0">
      {/* Mobile Brand (visible only on < md) */}
      <div 
        onClick={() => setActiveView('home')} 
        className="md:hidden flex items-center gap-2 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-full bg-spotify-green flex items-center justify-center text-black shadow-md">
          <Music className="w-4 h-4 fill-black stroke-black" />
        </div>
        <div className="font-black text-lg tracking-tight">
          <span>Spotibai</span>
        </div>
      </div>

      {/* Desktop Navigation History Arrows (visible on md and up) */}
      <div className="hidden md:flex items-center gap-2">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          title="Go back"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            canGoBack
              ? 'bg-black/60 hover:bg-black text-white cursor-pointer'
              : 'bg-black/30 text-neutral-600 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          title="Go forward"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            canGoForward
              ? 'bg-black/60 hover:bg-black text-white cursor-pointer'
              : 'bg-black/30 text-neutral-600 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Keyboard Shortcuts Trigger (Desktop only) */}
        <button
          onClick={toggleShortcuts}
          title="Keyboard Shortcuts (?)"
          className="hidden md:flex w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 hover:border-white/30 text-neutral-300 hover:text-white items-center justify-center transition-colors shadow-sm"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* User Pill / Login Button */}
        {isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={toggleAccountMenu}
              title="Account & Premium Settings"
              className="flex items-center gap-2 py-1 px-2.5 sm:px-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 hover:border-white/30 text-white cursor-pointer transition-all shadow-sm active:scale-95"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-spotify-green to-emerald-300 flex items-center justify-center text-black font-black text-xs overflow-hidden flex-shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-3.5 h-3.5 fill-black stroke-black" />
                )}
              </div>
              <span className="text-xs font-bold hidden sm:inline">{user.name.split(' ')[0]}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-spotify-green/20 text-spotify-green">
                Premium
              </span>
            </button>

            {/* Account Menu Dropdown with Logout Button */}
            <AccountDropdown />
          </div>
        ) : (
          <button
            onClick={() => openAuthModal('login')}
            title="Log In to Spotibai"
            className="flex items-center gap-2 py-1.5 px-3.5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-xs cursor-pointer transition-all shadow-md active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5 text-black" />
            <span>Log In</span>
          </button>
        )}
      </div>
    </header>
  );
};
