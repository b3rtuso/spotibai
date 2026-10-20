import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';

installGlobalBrowserMocks();

describe('Tier 1: Feature Coverage (F1 - F7)', () => {
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

    // Reset stores to default initial state
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
  // Feature 1: Previous Track Button
  // --------------------------------------------------------------------------
  describe('F1: Previous Track Button', () => {
    it('F1.1: switches to previous track in queue when currentTime <= 3s', async () => {
      // Set up queue with 3 tracks, playing track at index 1
      await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS);
      playerStore.setState({ currentTime: 1.5 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
    });

    it('F1.2: restarts current track to 0:00 without decrementing queueIndex when currentTime > 3s', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[2], INITIAL_TRACKS);
      playerStore.setState({ currentTime: 15.0 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(2);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[2].id);
      expect(state.currentTime).toBe(0);
    });

    it('F1.3: restarts to 0:00 when at first track (queueIndex 0) and <= 3s with no prior history', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);
      await db.history.clear(); // remove history
      playerStore.setState({ currentTime: 2.0 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
      expect(state.currentTime).toBe(0);
    });

    it('F1.4: loops around to last track in queue when at first track and repeat mode is all', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);
      playerStore.setState({ repeat: 'all', currentTime: 1.0 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(INITIAL_TRACKS.length - 1);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[INITIAL_TRACKS.length - 1].id);
    });

    it('F1.5: switches to previous track after restart on consecutive previous click', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[2], INITIAL_TRACKS);
      playerStore.setState({ currentTime: 25.0 });

      // First click at >3s restarts track to 0
      await playerStore.getState().previousTrack();
      expect(playerStore.getState().currentTime).toBe(0);
      expect(playerStore.getState().queueIndex).toBe(2);

      // Second click at 0:00 (<= 3s) navigates to previous track in queue
      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(1);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[1].id);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Play/Pause Stability & Stream Sync
  // --------------------------------------------------------------------------
  describe('F2: Play/Pause Stability & Stream Sync', () => {
    it('F2.1: togglePlay when stopped starts playback and sets isPlaying to true', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);
      await playerStore.getState().togglePlay();
      expect(playerStore.getState().isPlaying).toBe(false);

      await playerStore.getState().togglePlay();
      expect(playerStore.getState().isPlaying).toBe(true);
    });

    it('F2.2: togglePlay while playing pauses active playback and sets isPlaying to false', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);
      expect(playerStore.getState().isPlaying).toBe(true);

      await playerStore.getState().togglePlay();

      expect(playerStore.getState().isPlaying).toBe(false);
    });

    it('F2.3: handles rapid alternating togglePlay sequence with zero unhandled exceptions', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      const toggles = [
        playerStore.getState().togglePlay(),
        playerStore.getState().togglePlay(),
        playerStore.getState().togglePlay(),
        playerStore.getState().togglePlay(),
      ];

      await expect(Promise.all(toggles)).resolves.not.toThrow();
    });

    it('F2.4: togglePlay with no track loaded loads first catalog track from database and begins playback', async () => {
      playerStore.setState({ currentTrack: null, queue: [], queueIndex: 0, isPlaying: false });

      await playerStore.getState().togglePlay();

      const state = playerStore.getState();
      expect(state.currentTrack).not.toBeNull();
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
      expect(state.isPlaying).toBe(true);
    });

    it('F2.5: handles YouTube track togglePlay smoothly via YouTubeEngine', async () => {
      const ytTrack = {
        ...INITIAL_TRACKS[0],
        id: 'yt-test-1',
        sourceType: 'youtube' as const,
        youtubeId: 'dQw4w9WgXcQ',
      };

      await playerStore.getState().playTrack(ytTrack, [ytTrack]);
      expect(playerStore.getState().isPlaying).toBe(true);

      await playerStore.getState().togglePlay();
      expect(playerStore.getState().isPlaying).toBe(false);

      await playerStore.getState().togglePlay();
      expect(playerStore.getState().isPlaying).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Scrubber Motion, Seeking & Volume
  // --------------------------------------------------------------------------
  describe('F3: Scrubber Motion, Seeking & Volume', () => {
    it('F3.1: audio timeupdate callback updates currentTime and duration in store', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      // Simulate timeupdate callback from AudioEngine
      if (audioEngine.onTimeUpdate) {
        audioEngine.onTimeUpdate(42.5, 184);
      }

      const state = playerStore.getState();
      expect(state.currentTime).toBe(42.5);
      expect(state.duration).toBe(184);
    });

    it('F3.2: seeking via seek(seconds) repositions playback timestamp immediately', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      playerStore.getState().seek(75);

      expect(playerStore.getState().currentTime).toBe(75);
    });

    it('F3.3: guards against NaN or 0 duration on loadedmetadata if track has duration', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      if (audioEngine.onTimeUpdate) {
        audioEngine.onTimeUpdate(10, NaN);
      }

      const state = playerStore.getState();
      expect(Number.isFinite(state.duration)).toBe(true);
      expect(state.duration).toBeGreaterThan(0);
    });

    it('F3.4: setVolume adjusts volume level and stores value within [0, 1]', () => {
      playerStore.getState().setVolume(0.45);

      const state = playerStore.getState();
      expect(state.volume).toBeCloseTo(0.45);
      expect(state.isMuted).toBe(false);
    });

    it('F3.5: toggleMute mutes volume to 0 and unmute restores previous volume level', () => {
      playerStore.getState().setVolume(0.7);

      // Mute
      playerStore.getState().toggleMute();
      expect(playerStore.getState().isMuted).toBe(true);
      expect(audioEngine.volume).toBeDefined();

      // Unmute restores
      playerStore.getState().toggleMute();
      expect(playerStore.getState().isMuted).toBe(false);
      expect(playerStore.getState().volume).toBeCloseTo(0.7);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Like Button (Heart) & State Sync
  // --------------------------------------------------------------------------
  describe('F4: Like Button (Heart) & State Sync', () => {
    it('F4.1: toggleLike marks track liked and persists isLiked in IndexedDB', async () => {
      const trackId = INITIAL_TRACKS[1].id; // initially unliked
      expect(INITIAL_TRACKS[1].isLiked).toBeFalsy();

      await libraryStore.getState().toggleLike(trackId);

      const updated = await db.tracks.get(trackId);
      expect(updated?.isLiked).toBe(true);

      const libTrack = libraryStore.getState().tracks.find((t) => t.id === trackId);
      expect(libTrack?.isLiked).toBe(true);
    });

    it('F4.2: toggleLike unlikes an already liked track in store and IndexedDB', async () => {
      const trackId = INITIAL_TRACKS[0].id; // initially liked in INITIAL_TRACKS
      expect(INITIAL_TRACKS[0].isLiked).toBe(true);

      await libraryStore.getState().toggleLike(trackId);

      const updated = await db.tracks.get(trackId);
      expect(updated?.isLiked).toBe(false);
    });

    it('F4.3: liking a track immediately syncs playerStore.currentTrack if currently playing', async () => {
      const track = INITIAL_TRACKS[1];
      await playerStore.getState().playTrack(track, INITIAL_TRACKS);
      expect(playerStore.getState().currentTrack?.isLiked).toBeFalsy();

      await libraryStore.getState().toggleLike(track.id);

      expect(playerStore.getState().currentTrack?.isLiked).toBe(true);
    });

    it('F4.4: liking a track updates all matching instances in playerStore.queue', async () => {
      const track = INITIAL_TRACKS[1];
      await playerStore.getState().playTrack(track, [track, INITIAL_TRACKS[0], track]);

      await libraryStore.getState().toggleLike(track.id);

      const queue = playerStore.getState().queue;
      expect(queue[0].isLiked).toBe(true);
      expect(queue[2].isLiked).toBe(true);
    });

    it('F4.5: supports trackFallback when liking an external track not yet in library', async () => {
      const externalTrack = {
        id: 'external-search-123',
        title: 'Search Hit Song',
        artist: 'Online Artist',
        album: 'Online Album',
        duration: 210,
        audioUrl: 'https://cdn.example.com/stream.mp3',
        artworkUrl: 'https://example.com/art.jpg',
        sourceType: 'online' as const,
        dateAdded: Date.now(),
      };

      await libraryStore.getState().toggleLike(externalTrack.id, externalTrack);

      const saved = await db.tracks.get(externalTrack.id);
      expect(saved).toBeDefined();
      expect(saved?.id).toBe(externalTrack.id);
      expect(saved?.isLiked).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Offline Download & Blob Storage
  // --------------------------------------------------------------------------
  describe('F5: Offline Download & Blob Storage', () => {
    it('F5.1: downloadTrack fetches audio blob and persists isDownloaded: true in IndexedDB', async () => {
      const track = INITIAL_TRACKS[0];

      const result = await downloadService.downloadTrack(track);

      expect(result.isDownloaded).toBe(true);
      expect(result.audioBlob).toBeDefined();

      const dbTrack = await db.tracks.get(track.id);
      expect(dbTrack?.isDownloaded).toBe(true);
      expect(dbTrack?.audioBlob).toBeDefined();
    });

    it('F5.2: downloadTrack invokes onProgress callback with advancing percentage up to 100%', async () => {
      const track = INITIAL_TRACKS[1];
      const progressUpdates: number[] = [];

      await downloadService.downloadTrack(track, (percent) => {
        progressUpdates.push(percent);
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
      expect(progressUpdates).toContain(20);
    });

    it('F5.3: removeDownloadedTrack clears audioBlob and resets isDownloaded to false', async () => {
      const track = INITIAL_TRACKS[0];
      await downloadService.downloadTrack(track);

      await downloadService.removeDownloadedTrack(track.id);

      const updated = await db.tracks.get(track.id);
      expect(updated?.isDownloaded).toBe(false);
      expect(updated?.audioBlob).toBeUndefined();
    });

    it('F5.4: downloadPlaylist downloads all member tracks and marks playlist isDownloaded', async () => {
      const playlist = INITIAL_PLAYLISTS[1]; // Chill Lofi (2 tracks)

      await downloadService.downloadPlaylist(playlist);

      const updatedPl = await db.playlists.get(playlist.id);
      expect(updatedPl?.isDownloaded).toBe(true);

      for (const trackId of playlist.trackIds) {
        const tr = await db.tracks.get(trackId);
        expect(tr?.isDownloaded).toBe(true);
      }
    });

    it('F5.5: playing a downloaded track with audioBlob loads from blob object URL', async () => {
      const track = INITIAL_TRACKS[0];
      const downloaded = await downloadService.downloadTrack(track);

      await playerStore.getState().playTrack(downloaded, [downloaded]);

      const state = playerStore.getState();
      expect(state.currentTrack?.isDownloaded).toBe(true);
      expect(state.isPlaying).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Spotify-Style Algorithmic Autoplay
  // --------------------------------------------------------------------------
  describe('F6: Spotify-Style Algorithmic Autoplay Engine', () => {
    it('F6.1: queue exhaustion triggers autoplay and appends recommendations to queue', async () => {
      // Set queue to single track with repeat off
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], [INITIAL_TRACKS[0]]);
      playerStore.setState({ repeat: 'off' });

      // Trigger nextTrack on last song
      await playerStore.getState().nextTrack();

      const state = playerStore.getState();
      expect(state.queue.length).toBeGreaterThan(1);
      expect(state.isPlaying).toBe(true);
    });

    it('F6.2: autoplay engine rewards matching genre with higher recommendation score', async () => {
      const baseTrack = INITIAL_TRACKS[0]; // Synthwave
      // Add candidates with matching vs mismatching genre
      const matchTrack = {
        ...INITIAL_TRACKS[1],
        id: 'genre-match-candidate',
        genre: 'Synthwave',
        artist: 'Different Artist',
      };
      const mismatchTrack = {
        ...INITIAL_TRACKS[2],
        id: 'genre-mismatch-candidate',
        genre: 'Classical Opera',
        artist: 'Different Artist',
      };
      await db.tracks.put(matchTrack);
      await db.tracks.put(mismatchTrack);

      const recs = await autoplayEngine.getNextRecommendations(baseTrack, [baseTrack], [], 2);

      const ids = recs.map((r) => r.id);
      expect(ids).toContain('genre-match-candidate');
    });

    it('F6.3: autoplay engine rewards matching artist affinity with higher score', async () => {
      const baseTrack = INITIAL_TRACKS[0]; // Artist: 'Tours'
      const sameArtistTrack = {
        ...INITIAL_TRACKS[1],
        id: 'artist-match-candidate',
        artist: 'Tours',
        genre: 'Different Genre',
      };
      await db.tracks.put(sameArtistTrack);

      const recs = await autoplayEngine.getNextRecommendations(baseTrack, [baseTrack], [], 2);

      const ids = recs.map((r) => r.id);
      expect(ids).toContain('artist-match-candidate');
    });

    it('F6.4: autoplay engine heavily penalizes tracks already in current queue and recent history', async () => {
      const baseTrack = INITIAL_TRACKS[0];
      const inQueueTrack = INITIAL_TRACKS[1];
      const inHistoryTrack = INITIAL_TRACKS[2];

      const currentQueue = [baseTrack, inQueueTrack];
      const recentHistoryIds = [inHistoryTrack.id];

      const recs = await autoplayEngine.getNextRecommendations(
        baseTrack,
        currentQueue,
        recentHistoryIds,
        5
      );

      // Recommendations should not include tracks in the queue
      const ids = recs.map((r) => r.id);
      expect(ids).not.toContain(inQueueTrack.id);
    });

    it('F6.5: returns recommendation candidate tracks without duplicate IDs', async () => {
      const baseTrack = INITIAL_TRACKS[0];
      const recs = await autoplayEngine.getNextRecommendations(baseTrack, [baseTrack], [], 4);

      const ids = recs.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Browser Reload State Persistence (F5)
  // --------------------------------------------------------------------------
  describe('F7: Browser Reload State Persistence (F5)', () => {
    it('F7.1: playback state changes write session snapshot to localStorage spotibai_playback_session_v1', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS);
      playerStore.getState().seek(45);
      playerStore.getState().setVolume(0.6);

      // Advance timers for debounced persistSession (1500ms throttle)
      vi.advanceTimersByTime(2000);

      const raw = localStorage.getItem('spotibai_playback_session_v1');
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      expect(parsed.currentTrack.id).toBe(INITIAL_TRACKS[1].id);
      expect(parsed.volume).toBeCloseTo(0.6);
    });

    it('F7.2: saved session snapshot retains complete playback attributes', async () => {
      playerStore.setState({
        currentTrack: INITIAL_TRACKS[2],
        queue: INITIAL_TRACKS,
        queueIndex: 2,
        currentTime: 50,
        volume: 0.75,
        isMuted: false,
        shuffle: true,
        repeat: 'all',
      });

      // Trigger persist directly by seeking
      playerStore.getState().seek(50);
      vi.advanceTimersByTime(2000);

      const raw = localStorage.getItem('spotibai_playback_session_v1');
      const saved = JSON.parse(raw!);

      expect(saved.queue.length).toBe(INITIAL_TRACKS.length);
      expect(saved.queueIndex).toBe(2);
      expect(saved.shuffle).toBe(true);
      expect(saved.repeat).toBe('all');
    });

    it('F7.3: playerStore.init() re-hydrates saved session state from localStorage', async () => {
      const sessionToSave = {
        currentTrack: INITIAL_TRACKS[1],
        currentTime: 88,
        duration: 201,
        volume: 0.65,
        isMuted: false,
        shuffle: true,
        repeat: 'one' as const,
        queue: INITIAL_TRACKS,
        queueIndex: 1,
      };
      localStorage.setItem('spotibai_playback_session_v1', JSON.stringify(sessionToSave));

      // Reinitialize store
      playerStore.getState().init();

      const state = playerStore.getState();
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[1].id);
      expect(state.currentTime).toBe(88);
      expect(state.volume).toBeCloseTo(0.65);
      expect(state.shuffle).toBe(true);
      expect(state.repeat).toBe('one');
      expect(state.queueIndex).toBe(1);
    });

    it('F7.4: re-hydrating session does NOT automatically play audio (respects browser autoplay policy)', async () => {
      const sessionToSave = {
        currentTrack: INITIAL_TRACKS[0],
        currentTime: 30,
        volume: 0.8,
        queue: INITIAL_TRACKS,
        queueIndex: 0,
      };
      localStorage.setItem('spotibai_playback_session_v1', JSON.stringify(sessionToSave));

      playerStore.getState().init();

      expect(playerStore.getState().isPlaying).toBe(false);
    });

    it('F7.5: empty or corrupted localStorage gracefully falls back to default empty state without crashing', () => {
      localStorage.setItem('spotibai_playback_session_v1', '{corrupt json @@#$');

      expect(() => {
        playerStore.getState().init();
      }).not.toThrow();

      const state = playerStore.getState();
      expect(state.isPlaying).toBe(false);
    });
  });
});
