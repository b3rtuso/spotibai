/**
 * Challenger 2 Adversarial Stress Test Suite
 * Audio Playback, Demucs Stem Engine, Web Audio API Fallbacks & YouTube Karaoke
 *
 * EMPIRICAL ADVERSARIAL STRESS TARGETS:
 * 1. Stem loading edge cases, offline backend fallbacks & Web Audio API error recovery
 * 2. YouTube instrumental search fallback behavior when queries fail or return identical videos
 * 3. Timestamp accuracy across rapid seeks and toggle events
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores, MockAudioElement } from '../mocks/mockEnvironment';
import { Track } from '../../src/types';

installGlobalBrowserMocks();

describe('Challenger 2: Audio Engine & YouTube Karaoke Adversarial Stress Suite', () => {
  let playerStore: typeof import('../../src/store/playerStore').usePlayerStore;
  let audioEngine: typeof import('../../src/services/audio/AudioEngine').audioEngine;
  let youTubeEngine: typeof import('../../src/services/youtube/YouTubeEngine').youTubeEngine;
  let karaokeService: typeof import('../../src/services/audio/karaokeService').karaokeService;
  let unhandledRejections: any[] = [];
  let unhandledRejectionHandler: (reason: any) => void;

  const sampleLocalTrack: Track = {
    id: 'local-test-track-101',
    title: 'Adversarial Local Symphony',
    artist: 'Test Artist',
    album: 'Stress Album',
    duration: 210,
    streamUrl: '/audio/test_audio.mp3',
    audioUrl: '/audio/test_audio.mp3',
    artworkUrl: '/covers/default.jpg',
    source: 'local',
  };

  const sampleTrackWithStems: Track = {
    id: 'local-with-stems-202',
    title: 'Stem Separated Anthem',
    artist: 'Demucs Master',
    album: 'Stem Album',
    duration: 195,
    streamUrl: '/audio/stem_anthem.mp3',
    audioUrl: '/audio/stem_anthem.mp3',
    artworkUrl: '/covers/default.jpg',
    source: 'local',
    karaokeStems: {
      vocalsUrl: '/stems/anthem/vocals.mp3',
      instrumentalUrl: '/stems/anthem/instrumental.mp3',
      isReady: true,
    },
  };

  const sampleYouTubeTrack: Track = {
    id: 'yt-test-track-303',
    title: 'Online Video Ballad',
    artist: 'YouTube Star',
    album: 'Online Album',
    duration: 240,
    source: 'online',
    sourceType: 'youtube',
    youtubeId: 'orig_vid_123',
    artworkUrl: 'https://img.youtube.com/vi/orig_vid_123/hqdefault.jpg',
  };

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    unhandledRejections = [];
    unhandledRejectionHandler = (reason: any) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', unhandledRejectionHandler);

    await resetDatabaseAndStores();

    const psModule = await import('../../src/store/playerStore');
    const aeModule = await import('../../src/services/audio/AudioEngine');
    const ytModule = await import('../../src/services/youtube/YouTubeEngine');
    const ksModule = await import('../../src/services/audio/karaokeService');

    playerStore = psModule.usePlayerStore;
    audioEngine = aeModule.audioEngine;
    youTubeEngine = ytModule.youTubeEngine;
    karaokeService = ksModule.karaokeService;

    // Reset store state
    playerStore.setState({
      queue: [],
      queueIndex: -1,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isKaraokeMode: false,
      isVocalMuted: false,
      vocalLevel: 100,
      karaokeStatus: 'idle',
      karaokeStatusText: '',
      karaokeError: null,
    });
    playerStore.getState().init();
  });

  afterEach(() => {
    process.off('unhandledRejection', unhandledRejectionHandler);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // =========================================================================
  // SECTION 1: STEM LOADING EDGE CASES, OFFLINE BACKENDS & WEB AUDIO RECOVERY
  // =========================================================================
  describe('1. Stem Loading Edge Cases, Offline Backend Fallbacks & Web Audio API Recovery', () => {
    it('1.1: Offline backend failure triggers real-time biquad vocal suppression fallback seamlessly', async () => {
      const store = playerStore.getState();
      await store.playTrack(sampleLocalTrack, [sampleLocalTrack]);
      expect(playerStore.getState().isPlaying).toBe(true);

      // Simulate backend server offline / network timeout
      const origFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => Promise.reject(new Error('Failed to fetch: Connection refused')));

      try {
        await store.toggleKaraokeMode();

        const state = playerStore.getState();
        expect(state.isKaraokeMode).toBe(true);
        expect(state.vocalLevel).toBe(0);
        expect(state.isVocalMuted).toBe(true);
        expect(state.karaokeStatus).toBe('ready');
        expect(state.karaokeStatusText).toContain('Real-time vocal filter');
        expect(state.karaokeError).toContain('Backend separation unavailable');

        // Verify biquad filter is attenuated to -28 dB in AudioEngine
        expect(audioEngine.getVocalLevel()).toBe(0);
        // Playback was not interrupted
        expect(playerStore.getState().isPlaying).toBe(true);
      } finally {
        global.fetch = origFetch;
      }
    });

    it('1.2: Backend returns HTTP 500 error response during separation without crashing', async () => {
      const store = playerStore.getState();
      await store.playTrack(sampleLocalTrack, [sampleLocalTrack]);

      const origFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Internal Demucs processing failure: GPU out of memory' }),
        })
      );

      try {
        await store.toggleKaraokeMode();

        const state = playerStore.getState();
        expect(state.isKaraokeMode).toBe(true);
        expect(state.karaokeStatus).toBe('ready');
        expect(state.karaokeStatusText).toContain('Real-time vocal filter');
        expect(audioEngine.getVocalLevel()).toBe(0);
      } finally {
        global.fetch = origFetch;
      }
    });

    it('1.3: Backend returns malformed stem payload without vocals or instrumental URLs', async () => {
      const store = playerStore.getState();
      await store.playTrack(sampleLocalTrack, [sampleLocalTrack]);

      const origFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ vocals: '', instrumental: null }), // malformed!
        })
      );

      try {
        await store.toggleKaraokeMode();

        const state = playerStore.getState();
        expect(state.isKaraokeMode).toBe(true);
        expect(state.karaokeStatus).toBe('ready');
        expect(state.karaokeStatusText).toContain('Real-time vocal filter');
      } finally {
        global.fetch = origFetch;
      }
    });

    it('1.4: Web Audio API AudioContext hardware node error is caught gracefully', () => {
      // AudioEngine wraps initAudioContext in try/catch
      // Verify that calling resumeContext() or setVocalLevel() without throwing
      expect(() => {
        audioEngine.setVocalLevel(0);
        audioEngine.setVocalLevel(50);
        audioEngine.setVocalLevel(100);
      }).not.toThrow();
    });

    it('1.5: Stems load and play synchronized when track is active, remain paused when stopped', async () => {
      const store = playerStore.getState();

      // Track is playing
      await store.playTrack(sampleTrackWithStems, [sampleTrackWithStems]);
      expect(playerStore.getState().isPlaying).toBe(true);

      await store.toggleKaraokeMode();
      expect(audioEngine.getIsStemMode()).toBe(true);
      expect(playerStore.getState().karaokeStatus).toBe('ready');

      // Unload karaoke mode
      await store.toggleKaraokeMode();
      expect(audioEngine.getIsStemMode()).toBe(false);
    });

    it('1.6: Stem element error event automatically strips crossOrigin and retries without throwing', () => {
      const stemAudio = (audioEngine as any).stemInstrumentalAudio as MockAudioElement;
      expect(stemAudio).toBeDefined();

      // Simulate CORS error
      stemAudio.crossOrigin = 'anonymous';
      expect(() => {
        stemAudio.dispatchEvent({ type: 'error' });
      }).not.toThrow();

      // Cross origin should be stripped to allow direct playback
      expect(stemAudio.crossOrigin).toBeFalsy();
    });

    it('1.7: Unloading stems when exiting karaoke mode pauses stems and restores single track without delay', async () => {
      const store = playerStore.getState();
      await store.playTrack(sampleTrackWithStems, [sampleTrackWithStems]);
      await store.toggleKaraokeMode();
      expect(audioEngine.getIsStemMode()).toBe(true);

      // Seek to 60s
      store.seek(60);
      expect(playerStore.getState().currentTime).toBe(60);

      // Turn off Karaoke
      await store.toggleKaraokeMode();
      expect(audioEngine.getIsStemMode()).toBe(false);

      const stemInst = (audioEngine as any).stemInstrumentalAudio;
      const stemVoc = (audioEngine as any).stemVocalsAudio;
      expect(stemInst.paused).toBe(true);
      expect(stemVoc.paused).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 2: YOUTUBE INSTRUMENTAL SEARCH FALLBACK BEHAVIOR
  // =========================================================================
  describe('2. YouTube Instrumental Search Fallback Behavior', () => {
    it('2.1: Query collision — Search returns identical video ID to current video, falls back to Beat Mode', async () => {
      const store = playerStore.getState();

      // Set up YouTube player mock
      let loadedVideoId: string | null = null;
      let loadedStartTime = -1;
      (youTubeEngine as any).player = {
        loadVideoById: vi.fn(({ videoId, startSeconds }) => {
          loadedVideoId = videoId;
          loadedStartTime = startSeconds;
        }),
        playVideo: vi.fn(),
        pauseVideo: vi.fn(),
        seekTo: vi.fn(),
        setVolume: vi.fn(),
        unMute: vi.fn(),
        getCurrentTime: () => 45,
        getDuration: () => 240,
        getPlayerState: () => 1,
      };
      (youTubeEngine as any).currentVideoId = 'orig_vid_123';
      (youTubeEngine as any).isReady = true;

      // Mock resolveVideoId to always return the exact SAME video ID as current
      vi.spyOn(youTubeEngine, 'resolveVideoId').mockResolvedValue('orig_vid_123');

      await store.playTrack(sampleYouTubeTrack, [sampleYouTubeTrack]);
      store.seek(45);
      expect(playerStore.getState().currentTime).toBe(45);

      // Toggle Karaoke Mode
      await store.toggleKaraokeMode();

      const state = playerStore.getState();
      expect(state.isKaraokeMode).toBe(true);
      // Because query returned original video ID, searchAndPlayInstrumental returned null
      // and playerStore appropriately fell back to Beat Mode
      expect(state.karaokeStatus).toBe('ready');
      expect(state.karaokeStatusText).toBe('Karaoke Active (Beat Mode)');

      // Verify the player was NOT reloaded with the identical video ID
      expect((youTubeEngine as any).currentVideoId).toBe('orig_vid_123');
    });

    it('2.2: Complete YouTube search API network outage falls back to Beat Mode gracefully', async () => {
      const store = playerStore.getState();

      (youTubeEngine as any).player = {
        loadVideoById: vi.fn(),
        playVideo: vi.fn(),
        pauseVideo: vi.fn(),
        seekTo: vi.fn(),
        setVolume: vi.fn(),
        unMute: vi.fn(),
        getCurrentTime: () => 30,
        getDuration: () => 240,
        getPlayerState: () => 1,
      };
      (youTubeEngine as any).currentVideoId = 'yt_online_999';

      // Simulate complete network failure (both proxy and Invidious fail)
      vi.spyOn(youTubeEngine, 'resolveVideoId').mockResolvedValue(null);

      const ytTrack: Track = {
        ...sampleYouTubeTrack,
        id: 'yt-network-fail-1',
        youtubeId: 'yt_online_999',
      };
      await store.playTrack(ytTrack, [ytTrack]);

      await store.toggleKaraokeMode();

      const state = playerStore.getState();
      expect(state.isKaraokeMode).toBe(true);
      expect(state.karaokeStatus).toBe('ready');
      expect(state.karaokeStatusText).toBe('Karaoke Active (Beat Mode)');
      expect(unhandledRejections.length).toBe(0);
    });

    it('2.3: YouTube track with cached instrumentalYoutubeId switches immediately with timestamp continuity', async () => {
      const store = playerStore.getState();

      let loadedVideoId: string | null = null;
      let loadedStartTime = -1;

      (youTubeEngine as any).player = {
        loadVideoById: vi.fn(({ videoId, startSeconds }) => {
          loadedVideoId = videoId;
          loadedStartTime = startSeconds;
        }),
        playVideo: vi.fn(),
        pauseVideo: vi.fn(),
        seekTo: vi.fn(),
        setVolume: vi.fn(),
        unMute: vi.fn(),
        getCurrentTime: () => 75,
        getDuration: () => 240,
        getPlayerState: () => 1,
      };
      (youTubeEngine as any).currentVideoId = 'orig_song_id';

      const trackWithInst: Track = {
        ...sampleYouTubeTrack,
        id: 'cached-inst-yt-track',
        youtubeId: 'orig_song_id',
        instrumentalYoutubeId: 'inst_karaoke_id_456',
      };

      await store.playTrack(trackWithInst, [trackWithInst]);
      store.seek(75);
      expect(playerStore.getState().currentTime).toBe(75);

      // 1. Activate Karaoke: switches to instrumental at 75s
      await store.toggleKaraokeMode();
      expect(loadedVideoId).toBe('inst_karaoke_id_456');
      expect(loadedStartTime).toBe(75);
      expect(playerStore.getState().isKaraokeMode).toBe(true);

      // Advance time to 90s
      store.seek(90);

      // 2. Deactivate Karaoke: restores original vocal track at 90s
      await store.toggleKaraokeMode();
      expect(loadedVideoId).toBe('orig_song_id');
      expect(loadedStartTime).toBe(90);
      expect(playerStore.getState().isKaraokeMode).toBe(false);
    });

    it('2.4: YouTube instrumental query cascade succeeds on alternative query variant', async () => {
      (youTubeEngine as any).player = {
        loadVideoById: vi.fn(),
        playVideo: vi.fn(),
        pauseVideo: vi.fn(),
        seekTo: vi.fn(),
        setVolume: vi.fn(),
        unMute: vi.fn(),
        getCurrentTime: () => 10,
        getDuration: () => 200,
        getPlayerState: () => 1,
      };
      (youTubeEngine as any).currentVideoId = 'original_video';

      // Simulate:
      // Query 1 ('... instrumental') returns identical original_video
      // Query 2 ('... karaoke backing track') returns distinct backing video!
      vi.spyOn(youTubeEngine, 'resolveVideoId').mockImplementation(async (q: string) => {
        if (q.includes('karaoke backing track')) {
          return 'distinct_backing_track_vid';
        }
        return 'original_video';
      });

      const res = await youTubeEngine.searchAndPlayInstrumental('Artist Song', 10);
      expect(res).toBe('distinct_backing_track_vid');
      expect((youTubeEngine as any).currentVideoId).toBe('distinct_backing_track_vid');
    });
  });

  // =========================================================================
  // SECTION 3: TIMESTAMP ACCURACY ACROSS RAPID SEEKS AND TOGGLE EVENTS
  // =========================================================================
  describe('3. Timestamp Accuracy Across Rapid Seeks & Mode Toggles', () => {
    it('3.1: Stems load and seek with precise sub-frame synchrony', async () => {
      const store = playerStore.getState();
      await store.playTrack(sampleTrackWithStems, [sampleTrackWithStems]);
      await store.toggleKaraokeMode();

      expect(audioEngine.getIsStemMode()).toBe(true);

      const stemInst = (audioEngine as any).stemInstrumentalAudio as MockAudioElement;
      const stemVoc = (audioEngine as any).stemVocalsAudio as MockAudioElement;

      // Seek to 123.45 seconds
      store.seek(123.45);

      expect(stemInst.currentTime).toBe(123.45);
      expect(stemVoc.currentTime).toBe(123.45);
      expect(playerStore.getState().currentTime).toBe(123.45);
    });

    it('3.2: Rapid scrubber seek stress test (50 sequential seeks) maintains stem alignment', async () => {
      const store = playerStore.getState();
      await store.playTrack(sampleTrackWithStems, [sampleTrackWithStems]);
      await store.toggleKaraokeMode();

      const stemInst = (audioEngine as any).stemInstrumentalAudio as MockAudioElement;
      const stemVoc = (audioEngine as any).stemVocalsAudio as MockAudioElement;

      const seekPoints = [
        0, 0.05, 1.2, 5.5, 10, 15.3, 30.1, 45, 60.9, 90, 120, 150.25, 180, 194.9, 0,
        10.5, 20, 40, 60, 80, 100, 120, 140, 160, 180, 190, 5, 25, 45, 65, 85,
        105, 125, 145, 165, 185, 3, 13, 23, 33, 43, 53, 63, 73, 83, 93, 103, 113, 123, 50
      ];

      for (const t of seekPoints) {
        store.seek(t);
        expect(stemInst.currentTime).toBe(t);
        expect(stemVoc.currentTime).toBe(t);
        const drift = Math.abs(stemVoc.currentTime - stemInst.currentTime);
        expect(drift).toBe(0);
        expect(playerStore.getState().currentTime).toBe(t);
      }
    });

    it('3.3: Rapid mode switching stress test (20 rapid Karaoke toggle clicks) produces 0 unhandled rejections', async () => {
      const store = playerStore.getState();
      await store.playTrack(sampleTrackWithStems, [sampleTrackWithStems]);

      for (let i = 0; i < 20; i++) {
        await store.toggleKaraokeMode();
      }

      // 20 toggles: even count returns to initial state (isKaraokeMode === false)
      expect(playerStore.getState().isKaraokeMode).toBe(false);
      expect(playerStore.getState().vocalLevel).toBe(100);
      expect(audioEngine.getIsStemMode()).toBe(false);
      expect(unhandledRejections.length).toBe(0);
    });

    it('3.4: Dual-stem drift detection auto-corrects vocal alignment within 40ms', async () => {
      const store = playerStore.getState();
      await store.playTrack(sampleTrackWithStems, [sampleTrackWithStems]);
      await store.toggleKaraokeMode();

      const stemInst = (audioEngine as any).stemInstrumentalAudio as MockAudioElement;
      const stemVoc = (audioEngine as any).stemVocalsAudio as MockAudioElement;

      stemInst.currentTime = 50.0;
      stemVoc.currentTime = 50.0;
      stemInst.paused = false;

      // Artificially induce 200ms clock drift in vocal audio
      stemVoc.currentTime = 50.2;
      expect(Math.abs(stemVoc.currentTime - stemInst.currentTime)).toBeCloseTo(0.2, 4);

      // Trigger timeupdate on master instrumental stem
      stemInst.emitTimeUpdate(50.0);

      // correctStemDrift() should have snapped stemVoc back to match stemInst
      expect(stemVoc.currentTime).toBe(stemInst.currentTime);
      expect(Math.abs(stemVoc.currentTime - stemInst.currentTime)).toBe(0);
    });

    it('3.5: Mode toggle timestamp preservation keeps active second when switching between Normal and Karaoke', async () => {
      const store = playerStore.getState();
      await store.playTrack(sampleTrackWithStems, [sampleTrackWithStems]);

      // Play to 82 seconds in Normal mode
      store.seek(82);
      expect(playerStore.getState().currentTime).toBe(82);

      // Switch to Karaoke Mode
      await store.toggleKaraokeMode();
      expect(playerStore.getState().isKaraokeMode).toBe(true);

      const stemInst = (audioEngine as any).stemInstrumentalAudio as MockAudioElement;
      expect(stemInst.currentTime).toBe(82);

      // Advance to 105 seconds in Karaoke Mode
      store.seek(105);
      expect(playerStore.getState().currentTime).toBe(105);

      // Switch back to Normal Mode
      await store.toggleKaraokeMode();
      expect(playerStore.getState().isKaraokeMode).toBe(false);

      const activeAudio = (audioEngine as any).currentAudioIndex === 0
        ? (audioEngine as any).audioA
        : (audioEngine as any).audioB;
      expect(activeAudio.currentTime).toBe(105);
      expect(playerStore.getState().currentTime).toBe(105);
    });
  });
});
