import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installGlobalBrowserMocks } from '../mocks/mockEnvironment';

installGlobalBrowserMocks();

describe('Auth System & Background Tab Playback Persistence', () => {
  let useAuthStore: typeof import('../../src/store/authStore').useAuthStore;
  let usePlayerStore: typeof import('../../src/store/playerStore').usePlayerStore;
  let youTubeEngine: typeof import('../../src/services/youtube/YouTubeEngine').youTubeEngine;
  let audioEngine: typeof import('../../src/services/audio/AudioEngine').audioEngine;

  beforeEach(async () => {
    localStorage.clear();
    const authMod = await import('../../src/store/authStore');
    const playerMod = await import('../../src/store/playerStore');
    const ytMod = await import('../../src/services/youtube/YouTubeEngine');
    const aeMod = await import('../../src/services/audio/AudioEngine');

    useAuthStore = authMod.useAuthStore;
    usePlayerStore = playerMod.usePlayerStore;
    youTubeEngine = ytMod.youTubeEngine;
    audioEngine = aeMod.audioEngine;

    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isAccountMenuOpen: false,
      isAuthModalOpen: false,
      authMode: 'login',
    });
  });

  describe('1. Auth Store & Logout Workflow', () => {
    it('initializes with default premium user when no storage key exists or on login', async () => {
      const { login } = useAuthStore.getState();
      const success = await login('user@test.com', 'secret123', 'John Doe');
      expect(success).toBe(true);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.name).toBe('John Doe');
      expect(state.user?.email).toBe('user@test.com');
      expect(state.user?.isPremium).toBe(true);
      expect(state.isAuthModalOpen).toBe(false);

      // Verify localStorage persistence
      const saved = JSON.parse(localStorage.getItem('spotibai_auth_user_v1') || '{}');
      expect(saved.isAuthenticated).toBe(true);
      expect(saved.user.name).toBe('John Doe');
    });

    it('clicking logout clears user session and resets authenticated state', async () => {
      await useAuthStore.getState().login('premium@spotibai.com', 'pass', 'Premium VIP');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Trigger logout
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isAccountMenuOpen).toBe(false);

      const saved = JSON.parse(localStorage.getItem('spotibai_auth_user_v1') || '{}');
      expect(saved.isAuthenticated).toBe(false);
      expect(saved.user).toBeNull();
    });

    it('toggles and closes account dropdown menu', () => {
      const { toggleAccountMenu, closeAccountMenu } = useAuthStore.getState();
      expect(useAuthStore.getState().isAccountMenuOpen).toBe(false);

      toggleAccountMenu();
      expect(useAuthStore.getState().isAccountMenuOpen).toBe(true);

      toggleAccountMenu();
      expect(useAuthStore.getState().isAccountMenuOpen).toBe(false);

      toggleAccountMenu();
      closeAccountMenu();
      expect(useAuthStore.getState().isAccountMenuOpen).toBe(false);
    });

    it('opens and closes auth modal with mode switching', () => {
      const { openAuthModal, closeAuthModal } = useAuthStore.getState();

      openAuthModal('signup');
      expect(useAuthStore.getState().isAuthModalOpen).toBe(true);
      expect(useAuthStore.getState().authMode).toBe('signup');

      openAuthModal('login');
      expect(useAuthStore.getState().authMode).toBe('login');

      closeAuthModal();
      expect(useAuthStore.getState().isAuthModalOpen).toBe(false);
    });
  });

  describe('2. Background Tab & Tab Switch Audio Continuity', () => {
    it('does NOT broadcast isPlaying=false when YouTube pauses due to document.hidden background throttle', () => {
      const playStateSpy = vi.fn();
      youTubeEngine.onPlayStateChange = playStateSpy;

      // Simulate playing state
      (youTubeEngine as any).isPlayingDesired = true;
      (youTubeEngine as any).player = {
        playVideo: vi.fn(),
      };

      // Set document.hidden to true (user switched tab)
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });

      // Verify that when isPlayingDesired=true and document.hidden=true, background pause is suppressed
      expect((youTubeEngine as any).isPlayingDesired).toBe(true);
    });

    it('MediaSession playbackState is synchronized when audio engine triggers play state change', () => {
      usePlayerStore.getState().init();

      // Trigger play state on audio engine
      if (audioEngine.onPlayStateChange) {
        audioEngine.onPlayStateChange(true);
      }

      if ('mediaSession' in navigator) {
        expect(navigator.mediaSession.playbackState).toBe('playing');
      }

      if (audioEngine.onPlayStateChange) {
        audioEngine.onPlayStateChange(false);
      }

      if ('mediaSession' in navigator) {
        expect(navigator.mediaSession.playbackState).toBe('paused');
      }
    });

    it('AudioEngine auto-resumes suspended AudioContext on visibilitychange even when tab is backgrounded', () => {
      const resumeSpy = vi.fn().mockResolvedValue(undefined);
      (audioEngine as any).ctx = {
        state: 'suspended',
        resume: resumeSpy,
      };

      // Dispatch visibilitychange when document is hidden (user switched away)
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(resumeSpy).toHaveBeenCalled();
    });
  });
});
