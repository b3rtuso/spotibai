import { create } from 'zustand';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isPremium: boolean;
  plan: string;
  memberSince: string;
}

const AUTH_STORAGE_KEY = 'spotibai_auth_user_v1';

export const DEFAULT_USER: UserProfile = {
  id: 'usr_premium_01',
  name: 'Spotibai Member',
  email: 'premium@spotibai.app',
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  isPremium: true,
  plan: 'Spotibai Premium Individual',
  memberSince: 'October 2026',
};

function loadSavedUser(): { user: UserProfile | null; isAuthenticated: boolean } {
  try {
    if (typeof localStorage === 'undefined') {
      return { user: DEFAULT_USER, isAuthenticated: true };
    }
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.isAuthenticated === false || parsed.user === null) {
        return { user: null, isAuthenticated: false };
      }
      if (parsed.user) {
        return { user: parsed.user, isAuthenticated: true };
      }
    }
  } catch {
    // ignore
  }
  // Default to logged-in Premium user
  return { user: DEFAULT_USER, isAuthenticated: true };
}

function persistAuth(user: UserProfile | null, isAuthenticated: boolean) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, isAuthenticated }));
    }
  } catch {
    // ignore
  }
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  isAccountMenuOpen: boolean;
  authMode: 'login' | 'signup';

  login: (email: string, password?: string, name?: string) => Promise<boolean>;
  signup: (email: string, password?: string, name?: string) => Promise<boolean>;
  logout: () => void;
  openAuthModal: (mode?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  toggleAccountMenu: () => void;
  closeAccountMenu: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

const initial = loadSavedUser();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initial.user,
  isAuthenticated: initial.isAuthenticated,
  isAuthModalOpen: false,
  isAccountMenuOpen: false,
  authMode: 'login',

  login: async (email: string, _password?: string, customName?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const displayName = customName?.trim() || cleanEmail.split('@')[0] || 'Spotibai User';
    const user: UserProfile = {
      id: `usr_${Date.now()}`,
      name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      email: cleanEmail,
      avatarUrl: DEFAULT_USER.avatarUrl,
      isPremium: true,
      plan: 'Spotibai Premium Individual',
      memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };

    set({
      user,
      isAuthenticated: true,
      isAuthModalOpen: false,
      isAccountMenuOpen: false,
    });
    persistAuth(user, true);
    return true;
  },

  signup: async (email: string, _password?: string, name?: string) => {
    return get().login(email, _password, name);
  },

  logout: () => {
    set({
      user: null,
      isAuthenticated: false,
      isAccountMenuOpen: false,
    });
    persistAuth(null, false);
  },

  openAuthModal: (mode: 'login' | 'signup' = 'login') => {
    set({ isAuthModalOpen: true, authMode: mode, isAccountMenuOpen: false });
  },

  closeAuthModal: () => {
    set({ isAuthModalOpen: false });
  },

  toggleAccountMenu: () => {
    set((state) => ({ isAccountMenuOpen: !state.isAccountMenuOpen }));
  },

  closeAccountMenu: () => {
    set({ isAccountMenuOpen: false });
  },

  updateProfile: (updates: Partial<UserProfile>) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...updates };
    set({ user: updated });
    persistAuth(updated, get().isAuthenticated);
  },
}));
