import React, { useRef, useEffect } from 'react';
import { LogOut, Crown, Sparkles, Check, ShieldCheck, Mail, Calendar } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const AccountDropdown: React.FC = () => {
  const { user, isAuthenticated, isAccountMenuOpen, closeAccountMenu, logout } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeAccountMenu();
      }
    }
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountMenuOpen, closeAccountMenu]);

  if (!isAccountMenuOpen || !isAuthenticated || !user) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-neutral-900/95 border border-white/15 shadow-2xl backdrop-blur-2xl p-4 z-50 text-white select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header Profile Info */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <div className="w-12 h-12 rounded-full ring-2 ring-spotify-green/50 bg-gradient-to-tr from-spotify-green to-emerald-300 flex items-center justify-center text-black font-black text-base overflow-hidden flex-shrink-0 shadow-md">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span>{user.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-bold truncate text-white">{user.name}</h4>
            <Sparkles className="w-3.5 h-3.5 text-spotify-green flex-shrink-0" />
          </div>
          <p className="text-xs text-neutral-400 truncate flex items-center gap-1 mt-0.5">
            <Mail className="w-3 h-3 text-neutral-500" />
            <span className="truncate">{user.email}</span>
          </p>
        </div>
      </div>

      {/* Premium Plan Card */}
      <div className="my-3 p-3 rounded-xl bg-gradient-to-br from-emerald-950/60 via-neutral-900 to-black border border-spotify-green/30 relative overflow-hidden">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-spotify-green fill-spotify-green" />
            <span className="text-xs font-bold text-spotify-green uppercase tracking-wide">
              {user.plan}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-spotify-green/20 text-spotify-green border border-spotify-green/30">
            <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
          </span>
        </div>
        <p className="text-[11px] text-neutral-300 leading-relaxed">
          AI Vocal Separation, Background Playback, Lossless Audio & Offline Access are unlocked.
        </p>
        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-neutral-500" /> Member since {user.memberSince}
          </span>
          <span className="flex items-center gap-0.5 text-neutral-400">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified
          </span>
        </div>
      </div>

      {/* Logout Action Button */}
      <div className="pt-1">
        <button
          onClick={() => {
            logout();
            closeAccountMenu();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-neutral-200 hover:text-red-400 text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
};
