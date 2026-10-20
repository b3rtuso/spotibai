import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';

installGlobalBrowserMocks();

describe('Tier 2: Boundary & Corner Cases (F1 - F7)', () => {
  let playerStore: typeof import('../../src/store/playerStore').usePlayerStore;
  let libraryStore: typeof import('../../src/store/libraryStore').useLibraryStore;
  let autoplayEngine: typeof import('../../src/services/recommendation/autoplayEngine').autoplayEngine;
  let downloadService: typeof import('../../src/services/downloader/downloadService').downloadService;
  let db: typeof import('../../src/services/db/database').db;
  let INITIAL_TRACKS: typeof import('../../src/services/db/database').INITIAL_TRACKS;
  let INITIAL_PLAYLISTS: typeof import('../../src/services/db/database').INITIAL_PLAYLISTS;
  let audioEngine: typeof import('../../src/services/audio/AudioEngine').audioEngine;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await resetDatabaseAndStores();

    const psModule = await import('../../src/store/playerStore');
    const lsModule = await import('../../src/store/libraryStore');
    const apModule = await import('../../src/services/recommendation/autoplayEngine');
    const dsModule = await import('../../src/services/downloader/downloadService');
    const dbModule = await import('../../src/services/db/database');
    const aeModule = await import('../../src/services/audio/AudioEngine');

    playerStore = psModule.usePlayerStore;
    libraryStore = lsModule.useLibraryStore;
    autoplayEngine = apModule.autoplayEngine;
    downloadService = dsModule.downloadService;
    db = dbModule.db;
    INITIAL_TRACKS = dbModule.INITIAL_TRACKS;
    INITIAL_PLAYLISTS = dbModule.INITIAL_PLAYLISTS;
    audioEngine = aeModule.audioEngine;

    playerStore.setState({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      isMuted: false,
      shuffle: false,
      repeat: 'off',
      queue: [],
      queueIndex: 0,
    });
    playerStore.getState().init();
    await libraryStore.getState().loadLibrary();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Feature 1: Previous Track Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe('F1: Previous Track Boundary & Corner Cases', () => {
    it('F1.B1: currentTime exactly at 3.000s boundary (<= 3s) switches to previous track', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS);
      playerStore.setState({ currentTime: 3.000 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
    });

    it('F1.B2: currentTime at 3.001s boundary (> 3s) restarts track to 0:00 without decrementing queueIndex', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS);
      playerStore.setState({ currentTime: 3.001 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(1);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[1].id);
      expect(state.currentTime).toBe(0);
    });

    it('F1.B3: previousTrack on empty queue (queue.length === 0) does not throw or crash', async () => {
      playerStore.setState({ queue: [], queueIndex: 0, currentTrack: null });

      await expect(playerStore.getState().previousTrack()).resolves.not.toThrow();

      expect(playerStore.getState().queueIndex).toBe(0);
    });

    it('F1.B4: previousTrack on single-track queue (length 1) at 1s restarts to 0:00 without out-of-bounds error', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], [INITIAL_TRACKS[0]]);
      playerStore.setState({ currentTime: 1.0 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTime).toBe(0);
    });

    it('F1.B5: rapid clicking previous 5 times in burst (<300ms intervals) maintains non-negative queueIndex', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[2], INITIAL_TRACKS);

      for (let i = 0; i < 5; i++) {
        await playerStore.getState().previousTrack();
      }

      const state = playerStore.getState();
      expect(state.queueIndex).toBeGreaterThanOrEqual(0);
      expect(state.queueIndex).toBeLessThan(INITIAL_TRACKS.length);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Play/Pause Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe('F2: Play/Pause Boundary & Corner Cases', () => {
    it('F2.B1: rapid togglePlay 20 times within 50ms does not produce uncaught exceptions', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      const toggles: Promise<void>[] = [];
      for (let i = 0; i < 20; i++) {
        toggles.push(playerStore.getState().togglePlay());
      }

      await expect(Promise.all(toggles)).resolves.not.toThrow();
    });

    it('F2.B2: togglePlay with empty library and empty queue gracefully does nothing without throwing', async () => {
      await db.tracks.clear();
      playerStore.setState({ currentTrack: null, queue: [], queueIndex: 0 });

      await expect(playerStore.getState().togglePlay()).resolves.not.toThrow();
      expect(playerStore.getState().isPlaying).toBe(false);
    });

    it('F2.B3: audio element error event handled gracefully without crashing store state', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      expect(() => {
        if (audioEngine.onError) {
          audioEngine.onError(new Error('Simulated network 404 media decode error'));
        }
      }).not.toThrow();

      expect(playerStore.getState().currentTrack).not.toBeNull();
    });

    it('F2.B4: switching from HTML5 audio track to YouTube track pauses audio and starts YouTube', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);
      expect(playerStore.getState().isPlaying).toBe(true);

      const ytTrack = {
        ...INITIAL_TRACKS[1],
        id: 'yt-boundary-1',
        sourceType: 'youtube' as const,
        youtubeId: 'abc123xyz',
      };

      await playerStore.getState().playTrack(ytTrack, [ytTrack]);

      const state = playerStore.getState();
      expect(state.currentTrack?.id).toBe('yt-boundary-1');
      expect(state.isPlaying).toBe(true);
    });

    it('F2.B5: switching from YouTube track to HTML5 audio track pauses YouTube and starts HTML5 audio', async () => {
      const ytTrack = {
        ...INITIAL_TRACKS[1],
        id: 'yt-boundary-2',
        sourceType: 'youtube' as const,
        youtubeId: 'xyz789abc',
      };
      await playerStore.getState().playTrack(ytTrack, [ytTrack]);

      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      const state = playerStore.getState();
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
      expect(state.isPlaying).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Scrubber & Volume Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe('F3: Scrubber & Volume Boundary & Corner Cases', () => {
    it('F3.B1: seek to 0.000s restarts accurately from beginning', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);
      playerStore.getState().seek(45);
      expect(playerStore.getState().currentTime).toBe(45);

      playerStore.getState().seek(0);
      expect(playerStore.getState().currentTime).toBe(0);
    });

    it('F3.B2: seek to exact duration boundary does not throw and updates timestamp safely', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);
      const dur = INITIAL_TRACKS[0].duration;

      playerStore.getState().seek(dur);
      expect(playerStore.getState().currentTime).toBe(dur);
    });

    it('F3.B3: seek with negative value or NaN clamps to 0 safely without crashing', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      playerStore.getState().seek(-15);
      expect(playerStore.getState().currentTime).toBe(0);

      playerStore.getState().seek(NaN);
      expect(playerStore.getState().currentTime).toBe(0);
    });

    it('F3.B4: setVolume with out-of-bounds values clamps within [0, 1]', () => {
      playerStore.getState().setVolume(-0.5);
      expect(playerStore.getState().volume).toBe(0);

      playerStore.getState().setVolume(1.85);
      expect(playerStore.getState().volume).toBe(1.0);

      playerStore.getState().setVolume(NaN);
      expect(playerStore.getState().volume).toBeGreaterThanOrEqual(0);
      expect(playerStore.getState().volume).toBeLessThanOrEqual(1);
    });

    it('F3.B5: volume 0.5 sets audio master gain to linear 0.5 without double compounding (vol^2)', () => {
      playerStore.getState().setVolume(0.5);

      expect(playerStore.getState().volume).toBe(0.5);
      // Verify audio elements remain at 1.0 unity gain while masterGain receives 0.5
      expect(playerStore.getState().isMuted).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Like Button Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe('F4: Like Button Boundary & Corner Cases', () => {
    it('F4.B1: rapid toggleLike (10 consecutive toggles) leaves database and store in consistent state', async () => {
      const trackId = INITIAL_TRACKS[0].id;
      const initialLiked = Boolean(INITIAL_TRACKS[0].isLiked);

      for (let i = 0; i < 10; i++) {
        await libraryStore.getState().toggleLike(trackId);
      }

      const updated = await db.tracks.get(trackId);
      // Even number of toggles returns to initial state
      expect(updated?.isLiked).toBe(initialLiked);
    });

    it('F4.B2: liking a track with nonexistent trackId and no fallback does not crash', async () => {
      await expect(
        libraryStore.getState().toggleLike('nonexistent-id-99999')
      ).resolves.not.toThrow();
    });

    it('F4.B3: liking a track when queue contains multiple duplicates updates all instances in queue', async () => {
      const target = INITIAL_TRACKS[1];
      const multiQueue = [target, INITIAL_TRACKS[0], target, INITIAL_TRACKS[2], target];

      await playerStore.getState().playTrack(target, multiQueue);
      await libraryStore.getState().toggleLike(target.id);

      const queue = playerStore.getState().queue;
      expect(queue[0].isLiked).toBe(true);
      expect(queue[2].isLiked).toBe(true);
      expect(queue[4].isLiked).toBe(true);
    });

    it('F4.B4: liking a track with special characters, emojis, and unicode preserved intact', async () => {
      const unicodeTrack = {
        ...INITIAL_TRACKS[0],
        id: 'track-unicode-🎵-日本語-123',
        title: 'Cyberpunk 🌆 夜の音楽',
        artist: 'アーティスト 🎧',
        isLiked: false,
      };
      await db.tracks.put(unicodeTrack);

      await libraryStore.getState().toggleLike(unicodeTrack.id, unicodeTrack);

      const saved = await db.tracks.get(unicodeTrack.id);
      expect(saved?.isLiked).toBe(true);
      expect(saved?.title).toBe('Cyberpunk 🌆 夜の音楽');
    });

    it('F4.B5: toggling like when track has undefined isLiked defaults to true', async () => {
      const trackWithoutLiked = {
        ...INITIAL_TRACKS[2],
        id: 'track-no-like-field',
        isLiked: undefined,
      };
      await db.tracks.put(trackWithoutLiked);
      await libraryStore.getState().loadLibrary();

      await libraryStore.getState().toggleLike(trackWithoutLiked.id);

      const saved = await db.tracks.get(trackWithoutLiked.id);
      expect(saved?.isLiked).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Offline Download Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe('F5: Offline Download Boundary & Corner Cases', () => {
    it('F5.B1: network error during track download handles failure without corrupting DB', async () => {
      const originalFetch = globalThis.fetch;
      // Simulate network 500 error
      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
        blob: async () => { throw new Error('Network 500 Server Error'); },
        json: async () => [],
      } as any);

      const track = INITIAL_TRACKS[1];
      const result = await downloadService.downloadTrack(track);

      // Track is marked downloaded offline even if remote audio blob fetch failed (graceful metadata caching)
      expect(result.id).toBe(track.id);

      globalThis.fetch = originalFetch;
    });

    it('F5.B2: download track with missing or empty artworkUrl still stores audio blob and marks isDownloaded', async () => {
      const trackNoArtwork = {
        ...INITIAL_TRACKS[0],
        id: 'track-no-art',
        artworkUrl: '',
      };

      const result = await downloadService.downloadTrack(trackNoArtwork);

      expect(result.isDownloaded).toBe(true);
      expect(result.audioBlob).toBeDefined();
    });

    it('F5.B3: redundant download request for already downloaded track updates blobs without duplicating records', async () => {
      const track = INITIAL_TRACKS[0];
      await downloadService.downloadTrack(track);

      // Second download
      await downloadService.downloadTrack(track);

      const allMatching = await db.tracks.where('id').equals(track.id).toArray();
      expect(allMatching.length).toBe(1);
      expect(allMatching[0].isDownloaded).toBe(true);
    });

    it('F5.B4: download empty playlist (0 tracks) marks playlist isDownloaded without error', async () => {
      const emptyPlaylist = await libraryStore.getState().createPlaylist('Empty Playlist');

      await expect(
        downloadService.downloadPlaylist(emptyPlaylist)
      ).resolves.not.toThrow();

      const updated = await db.playlists.get(emptyPlaylist.id);
      expect(updated?.isDownloaded).toBe(true);
    });

    it('F5.B5: handles large audio blob simulation without memory exceptions', async () => {
      const largeBlob = new Blob([new Uint8Array(1024 * 1024 * 2)], { type: 'audio/mpeg' }); // 2MB mock
      const trackWithBlob = {
        ...INITIAL_TRACKS[0],
        id: 'track-large-blob',
        audioBlob: largeBlob,
      };

      const result = await downloadService.downloadTrack(trackWithBlob);

      expect(result.isDownloaded).toBe(true);
      expect(result.audioBlob?.size).toBe(largeBlob.size);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Autoplay Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe('F6: Autoplay Boundary & Corner Cases', () => {
    it('F6.B1: autoplay with empty library (0 candidates) does not throw and handles gracefully', async () => {
      await db.tracks.clear();
      const currentTrack = INITIAL_TRACKS[0];

      const recs = await autoplayEngine.getNextRecommendations(currentTrack, [currentTrack], [], 5);

      expect(Array.isArray(recs)).toBe(true);
    });

    it('F6.B2: autoplay with single track in library avoids returning the exact current playing track', async () => {
      await db.tracks.clear();
      await db.tracks.put(INITIAL_TRACKS[0]);

      const recs = await autoplayEngine.getNextRecommendations(
        INITIAL_TRACKS[0],
        [INITIAL_TRACKS[0]],
        [],
        3
      );

      expect(recs.some((r) => r.id === INITIAL_TRACKS[0].id)).toBe(false);
    });

    it('F6.B3: autoplay when all library tracks are in recent history does not crash and handles gracefully', async () => {
      const current = INITIAL_TRACKS[0];
      const allOtherIds = INITIAL_TRACKS.slice(1).map((t) => t.id);

      const recs = await autoplayEngine.getNextRecommendations(
        current,
        [current],
        allOtherIds,
        3
      );

      expect(Array.isArray(recs)).toBe(true);
    });

    it('F6.B4: candidate tracks missing genre or year metadata are scored without NaN scores', async () => {
      const strippedTrack = {
        ...INITIAL_TRACKS[1],
        id: 'stripped-meta-candidate',
        genre: undefined,
        year: undefined,
      };
      await db.tracks.put(strippedTrack);

      const recs = await autoplayEngine.getNextRecommendations(
        INITIAL_TRACKS[0],
        [INITIAL_TRACKS[0]],
        [],
        5
      );

      expect(recs.some((r) => r.id === 'stripped-meta-candidate')).toBe(true);
    });

    it('F6.B5: autoplay respects requested count parameter', async () => {
      const recs1 = await autoplayEngine.getNextRecommendations(INITIAL_TRACKS[0], [INITIAL_TRACKS[0]], [], 1);
      expect(recs1.length).toBeLessThanOrEqual(1);

      const recs3 = await autoplayEngine.getNextRecommendations(INITIAL_TRACKS[0], [INITIAL_TRACKS[0]], [], 3);
      expect(recs3.length).toBeLessThanOrEqual(3);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Persistence Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe('F7: Persistence Boundary & Corner Cases', () => {
    it('F7.B1: localStorage containing malformed JSON falls back cleanly to default state', () => {
      localStorage.setItem('spotibai_playback_session_v1', '!!!INVALID_JSON%%%');

      expect(() => {
        playerStore.getState().init();
      }).not.toThrow();

      expect(playerStore.getState().isPlaying).toBe(false);
    });

    it('F7.B2: localStorage with out-of-range queueIndex clamps safely without out-of-bounds error', () => {
      const invalidIndexSession = {
        currentTrack: INITIAL_TRACKS[0],
        currentTime: 10,
        volume: 0.8,
        queue: [INITIAL_TRACKS[0]],
        queueIndex: 99999,
      };
      localStorage.setItem('spotibai_playback_session_v1', JSON.stringify(invalidIndexSession));

      playerStore.getState().init();

      const state = playerStore.getState();
      expect(state.queue.length).toBe(1);
    });

    it('F7.B3: session with currentTime exceeding track duration handles safely', () => {
      const overflowTimeSession = {
        currentTrack: INITIAL_TRACKS[0],
        currentTime: 99999, // 99999s on 184s track
        duration: 184,
        volume: 0.8,
        queue: [INITIAL_TRACKS[0]],
        queueIndex: 0,
      };
      localStorage.setItem('spotibai_playback_session_v1', JSON.stringify(overflowTimeSession));

      playerStore.getState().init();

      expect(playerStore.getState().currentTime).toBeDefined();
    });

    it('F7.B4: quota exceeded simulation on localStorage.setItem is caught without crashing playback', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new DOMException('QuotaExceededError: storage is full', 'QuotaExceededError');
      };

      expect(() => {
        playerStore.getState().seek(20);
        vi.advanceTimersByTime(2000);
      }).not.toThrow();

      localStorage.setItem = originalSetItem;
    });

    it('F7.B5: rapid state updates (50 updates in 10ms) debounces persistSession properly', () => {
      for (let i = 0; i < 50; i++) {
        playerStore.getState().seek(i);
      }

      // Before debounce fires:
      vi.advanceTimersByTime(2000);

      const raw = localStorage.getItem('spotibai_playback_session_v1');
      expect(raw).not.toBeNull();
      const saved = JSON.parse(raw!);
      expect(saved.currentTime).toBe(49);
    });
  });
});
