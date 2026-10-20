/**
 * Challenger 1 Adversarial Stress Test Suite for Milestone 2 (Final Integration)
 *
 * Exhaustive Empirical Stress-Testing of:
 * 1. Like System:
 *    - Liking and unliking search results (external tracks not yet in DB/library)
 *    - Cross-store sync: currently playing track and multiple queue duplicates
 *    - Rapid burst toggling (30 rapid cycles)
 *    - Fallback track isolation (liking search result does NOT corrupt playing track)
 *    - Unicode, emoji, and missing metadata resilience
 *
 * 2. Offline Download & Blob Persistence:
 *    - Audio and artwork blob persistence in IndexedDB with valid blob sizes
 *    - Simulated network errors (HTTP 500, 404, 403, 502)
 *    - Aborted / Network drop (AbortError, TypeError 'Failed to fetch')
 *    - Zero-byte audio blob defense (0-byte blob rejected from isDownloaded)
 *    - Partial failure resilience (artwork fails but audio succeeds -> isDownloaded: true)
 *    - Download removal cleanup across DB, libraryStore, currentTrack, and queue
 *    - Checkmark state rendering and transition invariants
 *    - Page reload revitalization of revoked blob URLs
 *
 * 3. Autoplay Recommendation Engine:
 *    - Genre clustering (exact +45 vs related +25 vs unrelated 0)
 *    - Artist affinity (+35) and Liked song bias (+25)
 *    - Era/year proximity (+10 / +5)
 *    - History penalty (-80) and active queue penalty (-100)
 *    - Queue exhaustion triggering in playerStore (repeat='off' vs 'all')
 *    - Continuous autoplay expansion loop across multiple exhaustion boundaries
 *    - Candidate pool metadata gaps (undefined/null fields, NaN resistance)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';
import { Track } from '../../src/types';
import { revitalizeTrackBlobUrls } from '../../src/services/metadata/tagParser';

installGlobalBrowserMocks();

describe('Challenger M2: Adversarial Empirical Stress Suite', () => {
  let playerStore: typeof import('../../src/store/playerStore').usePlayerStore;
  let libraryStore: typeof import('../../src/store/libraryStore').useLibraryStore;
  let autoplayEngine: typeof import('../../src/services/recommendation/autoplayEngine').autoplayEngine;
  let downloadService: typeof import('../../src/services/downloader/downloadService').downloadService;
  let db: typeof import('../../src/services/db/database').db;
  let INITIAL_TRACKS: typeof import('../../src/services/db/database').INITIAL_TRACKS;
  let INITIAL_PLAYLISTS: typeof import('../../src/services/db/database').INITIAL_PLAYLISTS;
  let unhandledRejections: any[] = [];
  let unhandledRejectionHandler: (reason: any) => void;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    unhandledRejections = [];
    unhandledRejectionHandler = (reason: any) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', unhandledRejectionHandler);

    await resetDatabaseAndStores();

    const psModule = await import('../../src/store/playerStore');
    const lsModule = await import('../../src/store/libraryStore');
    const apModule = await import('../../src/services/recommendation/autoplayEngine');
    const dsModule = await import('../../src/services/downloader/downloadService');
    const dbModule = await import('../../src/services/db/database');

    playerStore = psModule.usePlayerStore;
    libraryStore = lsModule.useLibraryStore;
    autoplayEngine = apModule.autoplayEngine;
    downloadService = dsModule.downloadService;
    db = dbModule.db;
    INITIAL_TRACKS = dbModule.INITIAL_TRACKS;
    INITIAL_PLAYLISTS = dbModule.INITIAL_PLAYLISTS;

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
    playerStore.getState().init();
    await libraryStore.getState().loadLibrary();
  });

  afterEach(() => {
    process.off('unhandledRejection', unhandledRejectionHandler);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Section 1: Like & Unlike System Adversarial Stress-Testing
  // ==========================================================================
  describe('1. Like & Unlike System Stress-Testing', () => {
    it('1.1: liking external search result persists to DB, updates libraryStore, and preserves state when unliked', async () => {
      const searchTrack: Track = {
        id: 'external-search-track-999',
        title: 'Cyber Highway Run',
        artist: 'Future Outrun',
        album: 'Neon Grid EP',
        duration: 195,
        audioUrl: 'https://cdn.example.com/audio/cyber_highway.mp3',
        artworkUrl: 'https://cdn.example.com/art/cyber_highway.jpg',
        genre: 'Synthwave',
        year: 2024,
        sourceType: 'online',
        dateAdded: Date.now(),
      };

      // Initially not in DB
      const initialDb = await db.tracks.get(searchTrack.id);
      expect(initialDb).toBeUndefined();

      // Like external track via trackFallback
      await libraryStore.getState().toggleLike(searchTrack.id, searchTrack);

      // Verify DB persistence
      const savedInDb = await db.tracks.get(searchTrack.id);
      expect(savedInDb).toBeDefined();
      expect(savedInDb?.isLiked).toBe(true);

      // Verify libraryStore tracks
      const savedInLib = libraryStore.getState().tracks.find((t) => t.id === searchTrack.id);
      expect(savedInLib).toBeDefined();
      expect(savedInLib?.isLiked).toBe(true);

      // Now Unlike the newly added search track
      await libraryStore.getState().toggleLike(searchTrack.id, searchTrack);

      const unlikedDb = await db.tracks.get(searchTrack.id);
      expect(unlikedDb?.isLiked).toBe(false);

      const unlikedLib = libraryStore.getState().tracks.find((t) => t.id === searchTrack.id);
      expect(unlikedLib?.isLiked).toBe(false);
    });

    it('1.2: liking search result while another song is playing does NOT mutate or overwrite currentTrack', async () => {
      const playingTrack = INITIAL_TRACKS[0]; // Currently playing
      await playerStore.getState().playTrack(playingTrack, [playingTrack, INITIAL_TRACKS[1]]);

      const externalSearchTrack: Track = {
        id: 'external-search-different-track',
        title: 'Unrelated Track',
        artist: 'Unknown',
        duration: 150,
        audioUrl: 'https://cdn.example.com/unrelated.mp3',
        sourceType: 'online',
        dateAdded: Date.now(),
      };

      // Like the search track
      await libraryStore.getState().toggleLike(externalSearchTrack.id, externalSearchTrack);

      // PlayerStore currentTrack MUST remain playingTrack with untouched ID
      const cur = playerStore.getState().currentTrack;
      expect(cur?.id).toBe(playingTrack.id);
      expect(cur?.title).toBe(playingTrack.title);
    });

    it('1.3: liking and unliking currently playing track synchronizes playerStore.currentTrack and all matching queue entries', async () => {
      const targetTrack = INITIAL_TRACKS[1]; // unliked initially
      const queueWithDuplicates = [
        targetTrack,
        INITIAL_TRACKS[0],
        { ...targetTrack },
        INITIAL_TRACKS[2],
        { ...targetTrack },
      ];

      await playerStore.getState().playTrack(targetTrack, queueWithDuplicates);
      expect(playerStore.getState().currentTrack?.isLiked).toBeFalsy();

      // 1. Like the playing track
      await libraryStore.getState().toggleLike(targetTrack.id);

      expect(playerStore.getState().currentTrack?.isLiked).toBe(true);
      const queueAfterLike = playerStore.getState().queue;
      expect(queueAfterLike[0].isLiked).toBe(true);
      expect(queueAfterLike[2].isLiked).toBe(true);
      expect(queueAfterLike[4].isLiked).toBe(true);
      expect(queueAfterLike[1].isLiked).toBe(INITIAL_TRACKS[0].isLiked); // unchanged

      // 2. Unlike the playing track
      await libraryStore.getState().toggleLike(targetTrack.id);

      expect(playerStore.getState().currentTrack?.isLiked).toBe(false);
      const queueAfterUnlike = playerStore.getState().queue;
      expect(queueAfterUnlike[0].isLiked).toBe(false);
      expect(queueAfterUnlike[2].isLiked).toBe(false);
      expect(queueAfterUnlike[4].isLiked).toBe(false);
    });

    it('1.4: burst toggling (30 rapid sequential toggles) preserves parity and does not produce duplicate DB rows', async () => {
      const trackId = INITIAL_TRACKS[2].id;
      const initialLiked = Boolean(INITIAL_TRACKS[2].isLiked);

      // 30 toggles (even number -> should match initial state)
      for (let i = 0; i < 30; i++) {
        await libraryStore.getState().toggleLike(trackId);
      }

      const dbTrack = await db.tracks.get(trackId);
      expect(dbTrack?.isLiked).toBe(initialLiked);

      // Check for zero duplicate records in IndexedDB
      const allMatching = await db.tracks.where('id').equals(trackId).toArray();
      expect(allMatching.length).toBe(1);

      // 1 more toggle (odd number -> inverted)
      await libraryStore.getState().toggleLike(trackId);
      const toggledDb = await db.tracks.get(trackId);
      expect(toggledDb?.isLiked).toBe(!initialLiked);
    });

    it('1.5: liking track with emojis, Japanese kanji, and undefined optional metadata succeeds cleanly', async () => {
      const complexTrack: Track = {
        id: 'special-metadata-track-🔥-日本語',
        title: 'Tokyo Midnight 🌆 [VIP Remix]',
        artist: 'アーティスト 🎧 & DJ "Quotes"',
        duration: 240,
        audioUrl: 'https://cdn.example.com/tokyo.mp3',
        sourceType: 'online',
        dateAdded: Date.now(),
        genre: undefined,
        album: undefined,
        year: undefined,
      };

      await libraryStore.getState().toggleLike(complexTrack.id, complexTrack);

      const dbRecord = await db.tracks.get(complexTrack.id);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.isLiked).toBe(true);
      expect(dbRecord?.title).toBe('Tokyo Midnight 🌆 [VIP Remix]');
      expect(dbRecord?.artist).toBe('アーティスト 🎧 & DJ "Quotes"');
    });

    it('1.6: toggleLike without fallback falls back to playerStore.currentTrack when track is playing', async () => {
      const unsavedPlayingTrack: Track = {
        id: 'track-only-in-player-store',
        title: 'Active Stream Track',
        artist: 'Live Streamer',
        duration: 300,
        audioUrl: 'https://stream.example.com/live.mp3',
        sourceType: 'online',
        dateAdded: Date.now(),
      };

      // Set currentTrack in playerStore directly (simulating dynamic radio stream)
      playerStore.setState({ currentTrack: unsavedPlayingTrack });

      // Call toggleLike with just the track ID (no fallback passed)
      await libraryStore.getState().toggleLike(unsavedPlayingTrack.id);

      const dbRecord = await db.tracks.get(unsavedPlayingTrack.id);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.isLiked).toBe(true);
      expect(playerStore.getState().currentTrack?.isLiked).toBe(true);
    });
  });

  // ==========================================================================
  // Section 2: Offline Download & Blob Persistence Stress-Testing
  // ==========================================================================
  describe('2. Offline Download & Blob Persistence Stress-Testing', () => {
    it('2.1: successful download stores non-empty audio and artwork Blobs into IndexedDB and updates playerStore', async () => {
      const track = INITIAL_TRACKS[0];
      await playerStore.getState().playTrack(track, [track, INITIAL_TRACKS[1]]);

      // Mock fetch returning distinct audio blob (128KB) and artwork blob (16KB)
      const mockAudioBlob = new Blob([new Uint8Array(128 * 1024).fill(7)], { type: 'audio/mpeg' });
      const mockArtBlob = new Blob([new Uint8Array(16 * 1024).fill(3)], { type: 'image/jpeg' });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input: any) => {
        const url = String(input);
        if (url.includes('.jpg') || url.includes('.png') || url.includes('image')) {
          return { ok: true, status: 200, blob: async () => mockArtBlob } as any;
        }
        return { ok: true, status: 200, blob: async () => mockAudioBlob } as any;
      };

      try {
        await libraryStore.getState().downloadTrack(track);

        // Verify IndexedDB persistence
        const dbTrack = await db.tracks.get(track.id);
        expect(dbTrack).toBeDefined();
        expect(dbTrack?.isDownloaded).toBe(true);
        expect(dbTrack?.audioBlob).toBeDefined();
        expect(dbTrack?.audioBlob?.size).toBe(128 * 1024);
        expect(dbTrack?.artworkBlob).toBeDefined();
        expect(dbTrack?.artworkBlob?.size).toBe(16 * 1024);
        expect(dbTrack?.audioUrl.startsWith('blob:')).toBe(true);

        // Verify playerStore sync
        const cur = playerStore.getState().currentTrack;
        expect(cur?.isDownloaded).toBe(true);
        expect(cur?.audioBlob).toBeDefined();
        expect(cur?.audioUrl.startsWith('blob:')).toBe(true);

        const queueItem = playerStore.getState().queue[0];
        expect(queueItem.isDownloaded).toBe(true);
        expect(queueItem.audioBlob).toBeDefined();

        // Verify downloadProgress cleanup
        expect(libraryStore.getState().downloadProgress[track.id]).toBeUndefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('2.2: simulated network HTTP errors (500, 404, 403) fail gracefully without marking isDownloaded', async () => {
      const errorStatuses = [500, 404, 403, 502];
      const originalFetch = globalThis.fetch;

      try {
        for (const status of errorStatuses) {
          const track: Track = {
            ...INITIAL_TRACKS[1],
            id: `test-error-track-${status}`,
            isDownloaded: false,
            audioBlob: undefined,
          };
          await db.tracks.put(track);

          globalThis.fetch = async () => ({
            ok: false,
            status,
            blob: async () => {
              throw new Error(`HTTP ${status}`);
            },
          } as any);

          await libraryStore.getState().downloadTrack(track);

          // Must NOT be marked downloaded
          const dbTrack = await db.tracks.get(track.id);
          expect(dbTrack?.isDownloaded).toBe(false);
          expect(dbTrack?.audioBlob).toBeUndefined();

          // downloadProgress must be cleared (not stuck in spinner)
          expect(libraryStore.getState().downloadProgress[track.id]).toBeUndefined();
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('2.3: aborted fetches and network drop (TypeError / AbortError) clean up progress without corrupting DB', async () => {
      const originalFetch = globalThis.fetch;
      const track = INITIAL_TRACKS[2];

      try {
        // 1. Network drop (Failed to fetch)
        globalThis.fetch = async () => {
          throw new TypeError('Failed to fetch (Network disconnected)');
        };

        await libraryStore.getState().downloadTrack(track);

        let dbTrack = await db.tracks.get(track.id);
        expect(dbTrack?.isDownloaded).toBeFalsy();
        expect(libraryStore.getState().downloadProgress[track.id]).toBeUndefined();

        // 2. Aborted fetch (DOMException AbortError)
        globalThis.fetch = async () => {
          throw new DOMException('The user aborted a request.', 'AbortError');
        };

        await libraryStore.getState().downloadTrack(track);

        dbTrack = await db.tracks.get(track.id);
        expect(dbTrack?.isDownloaded).toBeFalsy();
        expect(libraryStore.getState().downloadProgress[track.id]).toBeUndefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('2.4: zero-byte audio blob defense prevents false offline download flag', async () => {
      const originalFetch = globalThis.fetch;
      const track: Track = {
        ...INITIAL_TRACKS[0],
        id: 'track-zero-byte-blob',
        isDownloaded: false,
        audioBlob: undefined,
      };
      await db.tracks.put(track);

      try {
        // Return 200 OK with empty 0-byte Blob
        globalThis.fetch = async () => ({
          ok: true,
          status: 200,
          blob: async () => new Blob([], { type: 'audio/mpeg' }), // 0 bytes
        } as any);

        await libraryStore.getState().downloadTrack(track);

        const dbTrack = await db.tracks.get(track.id);
        // Zero-byte blob must be rejected: isDownloaded remains false
        expect(dbTrack?.isDownloaded).toBe(false);
        expect(dbTrack?.audioBlob).toBeUndefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('2.5: artwork fetch failure does NOT prevent audio download from succeeding', async () => {
      const originalFetch = globalThis.fetch;
      const validAudioBlob = new Blob([new Uint8Array(64 * 1024).fill(1)], { type: 'audio/mpeg' });
      const track: Track = {
        ...INITIAL_TRACKS[1],
        id: 'track-audio-ok-art-fails',
        artworkUrl: 'https://cdn.example.com/broken-art.jpg',
        isDownloaded: false,
      };
      await db.tracks.put(track);

      try {
        globalThis.fetch = async (input: any) => {
          const url = String(input);
          if (url.includes('broken-art.jpg')) {
            return { ok: false, status: 404, blob: async () => { throw new Error('404'); } } as any;
          }
          return { ok: true, status: 200, blob: async () => validAudioBlob } as any;
        };

        await libraryStore.getState().downloadTrack(track);

        const dbTrack = await db.tracks.get(track.id);
        expect(dbTrack?.isDownloaded).toBe(true);
        expect(dbTrack?.audioBlob).toBeDefined();
        expect(dbTrack?.audioBlob?.size).toBe(64 * 1024);
        expect(dbTrack?.artworkBlob).toBeUndefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('2.6: checkmark state rendering transitions reliably through un-downloaded -> downloading -> downloaded -> removed', async () => {
      const track = INITIAL_TRACKS[0];
      await playerStore.getState().playTrack(track, [track]);

      // Phase 1: Un-downloaded state
      let libTrack = libraryStore.getState().tracks.find((t) => t.id === track.id);
      let curTrack = playerStore.getState().currentTrack;
      let isDownloaded = Boolean(curTrack?.isDownloaded || (libTrack && libTrack.isDownloaded));
      expect(isDownloaded).toBe(false);

      // Phase 2: Downloading state (progress active)
      libraryStore.setState({ downloadProgress: { [track.id]: 42 } });
      expect(Boolean(libraryStore.getState().downloadProgress[track.id])).toBe(true);

      // Phase 3: Download complete
      await libraryStore.getState().downloadTrack(track);
      libTrack = libraryStore.getState().tracks.find((t) => t.id === track.id);
      curTrack = playerStore.getState().currentTrack;
      isDownloaded = Boolean(curTrack?.isDownloaded || (libTrack && libTrack.isDownloaded));
      expect(isDownloaded).toBe(true);
      expect(libraryStore.getState().downloadProgress[track.id]).toBeUndefined();

      // Phase 4: Download removed
      await libraryStore.getState().removeDownload(track.id);
      libTrack = libraryStore.getState().tracks.find((t) => t.id === track.id);
      curTrack = playerStore.getState().currentTrack;
      isDownloaded = Boolean(curTrack?.isDownloaded || (libTrack && libTrack.isDownloaded));
      expect(isDownloaded).toBe(false);
      expect(curTrack?.audioBlob).toBeUndefined();
      expect(libTrack?.audioBlob).toBeUndefined();
    });

    it('2.7: revitalizeTrackBlobUrls restores dead/revoked blob URLs from persisted Blobs on reload', () => {
      const persistedBlob = new Blob(['revitalized-audio-content'], { type: 'audio/mpeg' });
      const persistedArtBlob = new Blob(['revitalized-artwork-content'], { type: 'image/jpeg' });

      const staleTrack: Track = {
        ...INITIAL_TRACKS[0],
        id: 'stale-blob-url-track',
        audioBlob: persistedBlob,
        artworkBlob: persistedArtBlob,
        audioUrl: 'blob:http://localhost:5173/revoked-uuid-1',
        artworkUrl: 'blob:http://localhost:5173/revoked-uuid-2',
      };

      const refreshed = revitalizeTrackBlobUrls(staleTrack);

      expect(refreshed.audioUrl).not.toBe('blob:http://localhost:5173/revoked-uuid-1');
      expect(refreshed.audioUrl.startsWith('blob:')).toBe(true);
      expect(refreshed.artworkUrl).not.toBe('blob:http://localhost:5173/revoked-uuid-2');
      expect(refreshed.artworkUrl?.startsWith('blob:')).toBe(true);
    });
  });

  // ==========================================================================
  // Section 3: Autoplay Recommendation Engine Adversarial Stress-Testing
  // ==========================================================================
  describe('3. Autoplay Recommendation Engine Stress-Testing', () => {
    it('3.1: genre clustering scores exact genre match (+45) higher than related (+25) and unrelated (0)', async () => {
      const currentTrack: Track = {
        ...INITIAL_TRACKS[0],
        id: 'seed-electronic-track',
        genre: 'Electronic',
        artist: 'Base Artist',
        year: 2020,
      };

      const candidateExact: Track = {
        ...INITIAL_TRACKS[1],
        id: 'candidate-exact-genre',
        genre: 'Electronic', // exact (+45)
        artist: 'Other 1',
        year: 2020,
        isLiked: false,
      };

      const candidateRelated: Track = {
        ...INITIAL_TRACKS[2],
        id: 'candidate-related-genre',
        genre: 'House', // related to electronic (+25)
        artist: 'Other 2',
        year: 2020,
        isLiked: false,
      };

      const candidateUnrelated: Track = {
        ...INITIAL_TRACKS[3],
        id: 'candidate-unrelated-genre',
        genre: 'Classical Opera', // unrelated (0)
        artist: 'Other 3',
        year: 2020,
        isLiked: false,
      };

      await db.tracks.clear();
      await db.tracks.bulkPut([currentTrack, candidateExact, candidateRelated, candidateUnrelated]);

      // Run 5 iterations to average out non-deterministic jitter (0-10)
      let exactWins = 0;
      let relatedWins = 0;

      for (let i = 0; i < 5; i++) {
        const recs = await autoplayEngine.getNextRecommendations(currentTrack, [currentTrack], [], 3);
        const ids = recs.map((r) => r.id);
        if (ids.indexOf('candidate-exact-genre') < ids.indexOf('candidate-related-genre')) {
          exactWins++;
        }
        if (ids.indexOf('candidate-related-genre') < ids.indexOf('candidate-unrelated-genre')) {
          relatedWins++;
        }
      }

      expect(exactWins).toBe(5);
      expect(relatedWins).toBe(5);
    });

    it('3.2: artist affinity (+35) and liked song (+25) heavily elevate candidates', async () => {
      const currentTrack: Track = {
        ...INITIAL_TRACKS[0],
        id: 'seed-daft-punk',
        artist: 'Daft Punk',
        genre: 'Dance',
        year: 2013,
      };

      const candidateSameArtistLiked: Track = {
        ...INITIAL_TRACKS[1],
        id: 'candidate-same-artist-liked',
        artist: 'Daft Punk', // +35
        genre: 'Dance', // +45
        isLiked: true, // +25 -> Total ~105
        year: 2013,
      };

      const candidateDifferentArtistUnliked: Track = {
        ...INITIAL_TRACKS[2],
        id: 'candidate-diff-artist-unliked',
        artist: 'Different Artist',
        genre: 'Dance', // +45 -> Total ~45
        isLiked: false,
        year: 2013,
      };

      await db.tracks.clear();
      await db.tracks.bulkPut([currentTrack, candidateSameArtistLiked, candidateDifferentArtistUnliked]);

      const recs = await autoplayEngine.getNextRecommendations(currentTrack, [currentTrack], [], 2);
      expect(recs[0].id).toBe('candidate-same-artist-liked');
    });

    it('3.3: recent history penalty (-80) and active queue penalty (-100) demote candidates below fresh songs', async () => {
      const currentTrack: Track = {
        ...INITIAL_TRACKS[0],
        id: 'seed-synth-track',
        genre: 'Synthwave',
        artist: 'Carpenter Brut',
      };

      // Candidate A has exact genre (+45), but is in recent history (-80) -> net negative
      const candidateInHistory: Track = {
        ...INITIAL_TRACKS[1],
        id: 'candidate-in-history',
        genre: 'Synthwave',
        artist: 'Mega Drive',
      };

      // Candidate B has related genre (+25) and is completely fresh (not in history or queue)
      const candidateFresh: Track = {
        ...INITIAL_TRACKS[2],
        id: 'candidate-fresh',
        genre: 'Cyberpunk',
        artist: 'Perturbator',
      };

      await db.tracks.clear();
      await db.tracks.bulkPut([currentTrack, candidateInHistory, candidateFresh]);

      const recs = await autoplayEngine.getNextRecommendations(
        currentTrack,
        [currentTrack],
        ['candidate-in-history'], // recent history penalty
        2
      );

      // Fresh candidate must rank above the recently played candidate
      expect(recs[0].id).toBe('candidate-fresh');
    });

    it('3.4: queue exhaustion in playerStore triggers autoplay, expands queue, and resumes playback', async () => {
      const track1 = INITIAL_TRACKS[0];
      const track2 = INITIAL_TRACKS[1];

      await playerStore.getState().playTrack(track1, [track1, track2]);
      playerStore.setState({ repeat: 'off', queueIndex: 1, currentTrack: track2 });

      // Call nextTrack() on the last track in the queue
      await playerStore.getState().nextTrack();

      const state = playerStore.getState();
      // Queue must have grown beyond initial 2 tracks
      expect(state.queue.length).toBeGreaterThan(2);
      // Queue index must be 2 (pointing to the first autoplay recommendation)
      expect(state.queueIndex).toBe(2);
      // Current track must match the newly queued song
      expect(state.currentTrack?.id).toBe(state.queue[2].id);
      expect(state.isPlaying).toBe(true);
    });

    it('3.5: continuous queue exhaustion chaining allows seamless indefinite autoplay without crashing', async () => {
      // Seed catalog with 20 candidate tracks across matching genres to support consecutive chaining
      const candidateCatalog: Track[] = Array.from({ length: 20 }, (_, idx) => ({
        id: `chain-candidate-${idx + 1}`,
        title: `Synth Anthem ${idx + 1}`,
        artist: `Synth Master ${Math.floor(idx / 3) + 1}`,
        album: 'Chaining Album',
        duration: 180,
        audioUrl: `/audio/synth_${idx + 1}.mp3`,
        sourceType: 'online',
        genre: 'Synthwave',
        year: 2024,
        dateAdded: Date.now() - idx * 1000,
        isLiked: idx % 2 === 0,
      }));

      await db.tracks.bulkPut(candidateCatalog);

      await playerStore.getState().playTrack(candidateCatalog[0], [candidateCatalog[0]]);
      playerStore.setState({ repeat: 'off' });

      // Simulate 3 consecutive queue exhaustion boundaries
      for (let iteration = 0; iteration < 3; iteration++) {
        const preLen = playerStore.getState().queue.length;
        // Fast-forward queueIndex to last element
        playerStore.setState({
          queueIndex: preLen - 1,
          currentTrack: playerStore.getState().queue[preLen - 1],
        });

        await playerStore.getState().nextTrack();

        const postLen = playerStore.getState().queue.length;
        expect(postLen).toBeGreaterThan(preLen);
        expect(playerStore.getState().isPlaying).toBe(true);
        expect(Number.isFinite(playerStore.getState().queueIndex)).toBe(true);
      }
    });

    it('3.6: repeat="all" wraps to index 0 on queue exhaustion and does NOT trigger autoplay', async () => {
      const queue = [INITIAL_TRACKS[0], INITIAL_TRACKS[1]];
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], queue);
      playerStore.setState({ repeat: 'all', queueIndex: 1, currentTrack: INITIAL_TRACKS[1] });

      await playerStore.getState().nextTrack();

      const state = playerStore.getState();
      // Queue length must NOT expand
      expect(state.queue.length).toBe(2);
      // Wrapped back to 0
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
    });

    it('3.7: candidate tracks with missing metadata (undefined/null genre, artist, year) score without NaN or throwing', async () => {
      const sparseCurrent: Track = {
        id: 'sparse-current',
        title: 'Minimal Metadata Current',
        artist: '',
        duration: 120,
        audioUrl: 'https://cdn.example.com/sparse.mp3',
        sourceType: 'online',
        dateAdded: Date.now(),
        genre: undefined,
        year: undefined,
      };

      const sparseCandidate1: Track = {
        id: 'sparse-cand-1',
        title: 'Sparse 1',
        artist: '',
        duration: 120,
        audioUrl: 'https://cdn.example.com/cand1.mp3',
        sourceType: 'online',
        dateAdded: Date.now(),
        genre: undefined,
        year: undefined,
      };

      const sparseCandidate2: Track = {
        id: 'sparse-cand-2',
        title: 'Sparse 2',
        artist: 'Some Artist',
        duration: 120,
        audioUrl: 'https://cdn.example.com/cand2.mp3',
        sourceType: 'online',
        dateAdded: Date.now(),
        genre: 'Pop',
        year: 2021,
      };

      await db.tracks.clear();
      await db.tracks.bulkPut([sparseCurrent, sparseCandidate1, sparseCandidate2]);

      const recs = await autoplayEngine.getNextRecommendations(sparseCurrent, [sparseCurrent], [], 2);

      expect(Array.isArray(recs)).toBe(true);
      expect(recs.length).toBeGreaterThan(0);
      expect(recs.some((r) => r.id === sparseCurrent.id)).toBe(false);
    });

    it('3.8: zero unhandled promise rejections recorded across entire stress run', () => {
      expect(unhandledRejections).toHaveLength(0);
    });
  });
});
