/**
 * Challenger M2-2: Adversarial Stress Test Suite for Reload State Persistence (F5),
 * Blob URL Revitalization, and Post-Reload Playback Workflows.
 *
 * Verification Scope:
 * 1. Full State Restoration Across Simulated Reload (F5) - active track, queue, index, vol, mute, seek, shuffle, repeat
 * 2. Revoked Blob URL Revitalization & Offline Playback Survival
 * 3. Audio Engine Staging & Post-Reload Playback Resumption (togglePlay, seek, prev/next)
 * 4. Offline Flight Mode - Playing Downloaded Tracks with Network Disconnected
 * 5. Corrupted / Extreme Session Storage Boundary Handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';
import { Track } from '../../src/types';

installGlobalBrowserMocks();

describe('Challenger M2-2: Reload State Persistence & Blob Revitalization Suite', () => {
  let playerStore: typeof import('../../src/store/playerStore').usePlayerStore;
  let libraryStore: typeof import('../../src/store/libraryStore').useLibraryStore;
  let audioEngine: typeof import('../../src/services/audio/AudioEngine').audioEngine;
  let youTubeEngine: typeof import('../../src/services/youtube/YouTubeEngine').youTubeEngine;
  let downloadService: typeof import('../../src/services/downloader/downloadService').downloadService;
  let db: typeof import('../../src/services/db/database').db;
  let INITIAL_TRACKS: typeof import('../../src/services/db/database').INITIAL_TRACKS;

  let createdObjectUrls: string[] = [];
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    createdObjectUrls = [];

    // Spy on object URL lifecycle
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      const url = `blob:http://localhost:5173/${Math.random().toString(36).substring(2, 10)}`;
      createdObjectUrls.push(url);
      return url;
    });

    URL.revokeObjectURL = vi.fn((url: string) => {
      const idx = createdObjectUrls.indexOf(url);
      if (idx !== -1) createdObjectUrls.splice(idx, 1);
    });

    await resetDatabaseAndStores();

    const psModule = await import('../../src/store/playerStore');
    const lsModule = await import('../../src/store/libraryStore');
    const aeModule = await import('../../src/services/audio/AudioEngine');
    const ytModule = await import('../../src/services/youtube/YouTubeEngine');
    const dsModule = await import('../../src/services/downloader/downloadService');
    const dbModule = await import('../../src/services/db/database');

    playerStore = psModule.usePlayerStore;
    libraryStore = lsModule.useLibraryStore;
    audioEngine = aeModule.audioEngine;
    youTubeEngine = ytModule.youTubeEngine;
    downloadService = dsModule.downloadService;
    db = dbModule.db;
    INITIAL_TRACKS = dbModule.INITIAL_TRACKS;

    // Reset AudioEngine internal state
    (audioEngine as any).currentAudioIndex = 0;
    (audioEngine as any).isOutgoing = [false, false];
    (audioEngine as any).audioA.pause();
    (audioEngine as any).audioB.pause();
    (audioEngine as any).audioA.currentTime = 0;
    (audioEngine as any).audioB.currentTime = 0;
    (audioEngine as any).audioA.src = '';
    (audioEngine as any).audioB.src = '';
    (audioEngine as any).currentTrack = null;

    playerStore.setState({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      previousVolume: 0.8,
      isMuted: false,
      shuffle: false,
      repeat: 'off',
      queue: [],
      queueIndex: 0,
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Section 1: Full State Restoration Across Simulated Reload (F5)
  // ==========================================================================
  describe('Section 1: State Restoration Across Simulated Reload', () => {
    it('1.1: Restores active track, 5-track queue, queueIndex, seek time, volume, and modes', async () => {
      const extraTrack: Track = {
        ...INITIAL_TRACKS[0],
        id: 'track-5-custom',
        title: 'Extra Track',
      };
      const queueSlice = [...INITIAL_TRACKS, extraTrack];
      const activeTrack = queueSlice[3];

      playerStore.setState({
        currentTrack: activeTrack,
        queue: queueSlice,
        queueIndex: 3,
        currentTime: 74,
        duration: activeTrack.duration,
        volume: 0.45,
        previousVolume: 0.7,
        isMuted: false,
        shuffle: true,
        repeat: 'all',
        isPlaying: true,
      });

      // Seek triggers immediate / debounced persistence
      playerStore.getState().seek(74);
      vi.advanceTimersByTime(2000);

      // Verify localStorage was written
      const rawSession = localStorage.getItem('spotibai_playback_session_v1');
      expect(rawSession).not.toBeNull();

      // Wipe runtime store state to simulate blank memory space upon page reload
      playerStore.setState({
        currentTrack: null,
        queue: [],
        queueIndex: 0,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        isMuted: false,
        shuffle: false,
        repeat: 'off',
        isPlaying: false,
      });

      // Simulate F5 page reload initialization
      playerStore.getState().init();

      const state = playerStore.getState();
      expect(state.currentTrack?.id).toBe(activeTrack.id);
      expect(state.queue.length).toBe(5);
      expect(state.queueIndex).toBe(3);
      expect(state.currentTime).toBe(74);
      expect(state.duration).toBe(activeTrack.duration);
      expect(state.volume).toBeCloseTo(0.45);
      expect(state.isMuted).toBe(false);
      expect(state.shuffle).toBe(true);
      expect(state.repeat).toBe('all');
      expect(state.isPlaying).toBe(false); // Must NEVER autoplay on reload
    });

    it('1.2: Restores muted state and previousVolume cleanly', async () => {
      const activeTrack = INITIAL_TRACKS[1];
      playerStore.setState({
        currentTrack: activeTrack,
        queue: [activeTrack],
        queueIndex: 0,
        volume: 0.65,
        previousVolume: 0.65,
        isMuted: true,
        currentTime: 30,
      });

      playerStore.getState().seek(30);
      vi.advanceTimersByTime(2000);

      // Re-init store
      playerStore.setState({ isMuted: false, volume: 0.8 });
      playerStore.getState().init();

      const state = playerStore.getState();
      expect(state.isMuted).toBe(true);
      expect(state.volume).toBeCloseTo(0.65);
      expect(state.previousVolume).toBeCloseTo(0.65);
    });

    it('1.3: Window beforeunload event immediately commits session without debounce delay', async () => {
      const track = INITIAL_TRACKS[2];
      playerStore.getState().init();

      playerStore.setState({
        currentTrack: track,
        queue: [track],
        queueIndex: 0,
        currentTime: 105,
        volume: 0.9,
      });

      // Trigger beforeunload without advancing timers
      window.dispatchEvent(new Event('beforeunload'));

      const raw = localStorage.getItem('spotibai_playback_session_v1');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.currentTime).toBe(105);
      expect(parsed.currentTrack.id).toBe(track.id);
    });
  });

  // ==========================================================================
  // Section 2: Revoked Blob URL Revitalization & Offline Playback
  // ==========================================================================
  describe('Section 2: Revoked Blob URL Revitalization & Offline Playback', () => {
    it('2.1: Revitalizes dead blob URLs for audio and artwork blobs after simulated browser reload', async () => {
      const track = INITIAL_TRACKS[0];

      // Step 1: Download track into IndexedDB
      const downloaded = await downloadService.downloadTrack(track);
      expect(downloaded.isDownloaded).toBe(true);
      expect(downloaded.audioBlob).toBeDefined();

      const originalAudioBlobUrl = downloaded.audioUrl;
      const originalArtworkBlobUrl = downloaded.artworkUrl;

      // Stage session state with the downloaded track
      playerStore.setState({
        currentTrack: downloaded,
        queue: [downloaded],
        queueIndex: 0,
        currentTime: 40,
        volume: 0.8,
      });
      playerStore.getState().seek(40);
      vi.advanceTimersByTime(2000);

      // Step 2: Simulate F5 Reload - revoke old blob URLs
      URL.revokeObjectURL(originalAudioBlobUrl);
      if (originalArtworkBlobUrl && originalArtworkBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(originalArtworkBlobUrl);
      }

      // Step 3: Run full AppLayout initialization sequence (initPlayer -> loadLibrary)
      playerStore.getState().init();
      await libraryStore.getState().loadLibrary();

      // Step 4: Verify revitalized URLs
      const rehydratedTrack = playerStore.getState().currentTrack;
      expect(rehydratedTrack).toBeDefined();
      expect(rehydratedTrack?.id).toBe(track.id);
      expect(rehydratedTrack?.isDownloaded).toBe(true);
      expect(rehydratedTrack?.audioBlob).toBeDefined();
      expect(rehydratedTrack?.audioUrl).toMatch(/^blob:/);
      // The new URL must be distinct from the revoked dead URL
      expect(rehydratedTrack?.audioUrl).not.toBe(originalAudioBlobUrl);

      // Verify queue was also revitalized
      const queueTrack = playerStore.getState().queue[0];
      expect(queueTrack.isDownloaded).toBe(true);
      expect(queueTrack.audioBlob).toBeDefined();
      expect(queueTrack.audioUrl).toBe(rehydratedTrack?.audioUrl);
    });

    it('2.2: Playing revitalized offline track routes through AudioEngine with audioBlob object URL', async () => {
      const track = INITIAL_TRACKS[1];
      const downloaded = await downloadService.downloadTrack(track);

      // Stage and simulate reload
      playerStore.setState({
        currentTrack: downloaded,
        queue: [downloaded],
        queueIndex: 0,
        currentTime: 10,
        volume: 0.8,
      });
      playerStore.getState().seek(10);
      vi.advanceTimersByTime(2000);

      // Page reload
      playerStore.getState().init();
      await libraryStore.getState().loadLibrary();

      const activeTrack = playerStore.getState().currentTrack!;
      expect(activeTrack).toBeDefined();
      expect(activeTrack.audioBlob).toBeDefined();

      // Start playback of the offline track
      await playerStore.getState().playTrack(activeTrack);

      const state = playerStore.getState();
      expect(state.isPlaying).toBe(true);
      expect(state.currentTrack?.id).toBe(track.id);

      // AudioEngine must have an active audio source starting with blob:
      const activeAudio = (audioEngine as any).audioA;
      expect(activeAudio.src).toMatch(/^blob:/);
    });

    it('2.3: Offline Flight Mode: playback succeeds when network fetch throws error', async () => {
      const track = INITIAL_TRACKS[2];
      const downloaded = await downloadService.downloadTrack(track);

      // Stage and reload
      playerStore.setState({
        currentTrack: downloaded,
        queue: [downloaded],
        queueIndex: 0,
      });
      playerStore.getState().seek(5);
      vi.advanceTimersByTime(2000);

      playerStore.getState().init();
      await libraryStore.getState().loadLibrary();

      // Sever the network completely
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch (offline network)'));

      try {
        const reloadedTrack = playerStore.getState().currentTrack!;
        expect(reloadedTrack.audioBlob).toBeDefined();

        // Playing offline track must not invoke network fetch and must play cleanly
        await playerStore.getState().playTrack(reloadedTrack);

        expect(playerStore.getState().isPlaying).toBe(true);
        expect((audioEngine as any).audioA.src).toMatch(/^blob:/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ==========================================================================
  // Section 3: Audio Engine Staging & Post-Reload Playback Resumption
  // ==========================================================================
  describe('Section 3: Post-Reload Playback Resumption & Navigation', () => {
    it('3.1: Seeking after reload updates currentTime and stays within track duration', async () => {
      const track = INITIAL_TRACKS[0];
      const duration = track.duration || 180;

      playerStore.setState({
        currentTrack: track,
        queue: [track],
        queueIndex: 0,
        currentTime: 20,
        duration,
      });
      playerStore.getState().seek(20);
      vi.advanceTimersByTime(2000);

      // Reload
      playerStore.getState().init();

      // Seek to 95 seconds while paused
      playerStore.getState().seek(95);

      const state = playerStore.getState();
      expect(state.currentTime).toBe(95);
      expect(state.isPlaying).toBe(false);
    });

    it('3.2: Previous track at t > 3s after reload restarts to 0:00 without decrementing queueIndex', async () => {
      const queue = INITIAL_TRACKS.slice(0, 3);
      const track = queue[1];

      playerStore.setState({
        currentTrack: track,
        queue,
        queueIndex: 1,
        currentTime: 55, // > 3 seconds
        duration: track.duration,
      });
      playerStore.getState().seek(55);
      vi.advanceTimersByTime(2000);

      // Reload
      playerStore.getState().init();
      expect(playerStore.getState().currentTime).toBe(55);

      // Click Previous button
      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(1); // Stays on same song
      expect(state.currentTime).toBe(0); // Restarts to beginning
    });

    it('3.3: Previous track at t <= 3s after reload navigates to previous queue item', async () => {
      const queue = INITIAL_TRACKS.slice(0, 3);
      const track = queue[2];

      playerStore.setState({
        currentTrack: track,
        queue,
        queueIndex: 2,
        currentTime: 1.5, // <= 3 seconds
        duration: track.duration,
      });
      playerStore.getState().seek(1.5);
      vi.advanceTimersByTime(2000);

      // Reload
      playerStore.getState().init();

      // Click Previous button
      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(1);
      expect(state.currentTrack?.id).toBe(queue[1].id);
    });

    it('3.4: Next track after reload advances queue index smoothly', async () => {
      const queue = INITIAL_TRACKS.slice(0, 4);

      playerStore.setState({
        currentTrack: queue[1],
        queue,
        queueIndex: 1,
        currentTime: 30,
      });
      playerStore.getState().seek(30);
      vi.advanceTimersByTime(2000);

      // Reload
      playerStore.getState().init();

      // Click Next
      await playerStore.getState().nextTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(2);
      expect(state.currentTrack?.id).toBe(queue[2].id);
      expect(state.isPlaying).toBe(true);
    });

    it('3.5: Autoplay continuation on queue exhaustion after reload', async () => {
      // Reload on last track of a 2-track queue, so remaining tracks in DB act as candidates
      const queue = INITIAL_TRACKS.slice(0, 2);
      const lastIndex = queue.length - 1;
      const lastTrack = queue[lastIndex];

      playerStore.setState({
        currentTrack: lastTrack,
        queue,
        queueIndex: lastIndex,
        repeat: 'off',
      });
      playerStore.getState().seek(10);
      vi.advanceTimersByTime(2000);

      // Reload
      playerStore.getState().init();
      await libraryStore.getState().loadLibrary();

      // Exhaust queue via nextTrack()
      await playerStore.getState().nextTrack();

      const state = playerStore.getState();
      // Autoplay should have queued recommendations
      expect(state.queue.length).toBeGreaterThan(queue.length);
      expect(state.isPlaying).toBe(true);
    });

    it('3.6: Clicking togglePlay() (PlayerBar Play button) after reload plays restored track at saved currentTime', async () => {
      const track = INITIAL_TRACKS[0];
      const savedTime = 42;

      playerStore.setState({
        currentTrack: track,
        queue: [track],
        queueIndex: 0,
        currentTime: savedTime,
        volume: 0.8,
      });
      playerStore.getState().seek(savedTime);
      vi.advanceTimersByTime(2000);

      // Simulate browser reload
      playerStore.getState().init();
      await libraryStore.getState().loadLibrary();

      // AudioEngine must be currently blank before user clicks play
      const activeAudio = (audioEngine as any).audioA;
      expect(activeAudio.src).toBe('');

      // User clicks Play button in PlayerBar
      await playerStore.getState().togglePlay();

      // Playback must be active
      expect(playerStore.getState().isPlaying).toBe(true);

      // CRITICAL CHECK: AudioEngine active element MUST have loaded the track source
      expect(activeAudio.src).not.toBe('');
      expect(activeAudio.src).toContain(track.audioUrl.replace(/^\//, ''));
      // AND currentTime must be at or close to savedTime
      expect(activeAudio.currentTime).toBe(savedTime);
    });
  });

  // ==========================================================================
  // Section 4: Boundary & Resilience Under Malformed / Extreme LocalStorage
  // ==========================================================================
  describe('Section 4: Boundary & Malformed LocalStorage Resilience', () => {
    it('4.1: Handles out-of-bounds queueIndex in saved session without throwing', () => {
      const corruptedSession = {
        currentTrack: INITIAL_TRACKS[0],
        queue: [INITIAL_TRACKS[0]],
        queueIndex: 9999, // Way past queue length
        currentTime: 0,
        volume: 0.8,
      };
      localStorage.setItem('spotibai_playback_session_v1', JSON.stringify(corruptedSession));

      expect(() => {
        playerStore.getState().init();
      }).not.toThrow();

      const state = playerStore.getState();
      // Should clamp to 0
      expect(state.queueIndex).toBe(0);
    });

    it('4.2: Handles negative queueIndex gracefully', () => {
      const corruptedSession = {
        currentTrack: INITIAL_TRACKS[0],
        queue: [INITIAL_TRACKS[0]],
        queueIndex: -5,
        currentTime: 0,
        volume: 0.8,
      };
      localStorage.setItem('spotibai_playback_session_v1', JSON.stringify(corruptedSession));

      expect(() => {
        playerStore.getState().init();
      }).not.toThrow();

      expect(playerStore.getState().queueIndex).toBe(0);
    });

    it('4.3: Handles empty queue with active currentTrack by reconstructing [currentTrack]', () => {
      const session = {
        currentTrack: INITIAL_TRACKS[1],
        queue: [], // Empty queue
        queueIndex: 0,
        currentTime: 10,
        volume: 0.8,
      };
      localStorage.setItem('spotibai_playback_session_v1', JSON.stringify(session));

      playerStore.getState().init();

      const state = playerStore.getState();
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[1].id);
      expect(state.queue.length).toBe(1);
      expect(state.queue[0].id).toBe(INITIAL_TRACKS[1].id);
    });

    it('4.4: Rapid reload simulation (5 consecutive init cycles) maintains consistent state', async () => {
      const track = INITIAL_TRACKS[0];
      playerStore.setState({
        currentTrack: track,
        queue: [track],
        queueIndex: 0,
        currentTime: 50,
        volume: 0.75,
      });
      playerStore.getState().seek(50);
      vi.advanceTimersByTime(2000);

      // Perform 5 consecutive re-inits
      for (let i = 0; i < 5; i++) {
        playerStore.getState().init();
      }

      const state = playerStore.getState();
      expect(state.currentTrack?.id).toBe(track.id);
      expect(state.currentTime).toBe(50);
      expect(state.volume).toBeCloseTo(0.75);
    });
  });
});
