import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';
import { Track } from '../../src/types';

installGlobalBrowserMocks();

describe('Apple Music Sing Karaoke Mode & Demucs Stem Separation', () => {
  let usePlayerStore: typeof import('../../src/store/playerStore').usePlayerStore;
  let lyricsService: typeof import('../../src/services/lyrics/lyricsService').lyricsService;
  let karaokeService: typeof import('../../src/services/audio/karaokeService').karaokeService;

  beforeEach(async () => {
    await resetDatabaseAndStores();
    const psModule = await import('../../src/store/playerStore');
    const lsModule = await import('../../src/services/lyrics/lyricsService');
    const ksModule = await import('../../src/services/audio/karaokeService');

    usePlayerStore = psModule.usePlayerStore;
    lyricsService = lsModule.lyricsService;
    karaokeService = ksModule.karaokeService;

    usePlayerStore.setState({
      queue: [],
      queueIndex: -1,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isKaraokeMode: false,
      vocalLevel: 100,
      karaokeStatus: 'idle',
      karaokeStatusText: '',
    });
  });

  describe('1. Karaoke State Management in playerStore', () => {
    it('1.1: toggleKaraokeMode activates karaoke mode and mutes singer to 0 vocal level', () => {
      const store = usePlayerStore.getState();
      expect(store.isKaraokeMode).toBe(false);

      store.toggleKaraokeMode();
      expect(usePlayerStore.getState().isKaraokeMode).toBe(true);
      expect(usePlayerStore.getState().vocalLevel).toBe(0);
      expect(usePlayerStore.getState().isVocalMuted).toBe(true);

      store.toggleKaraokeMode();
      expect(usePlayerStore.getState().isKaraokeMode).toBe(false);
      expect(usePlayerStore.getState().vocalLevel).toBe(100);
      expect(usePlayerStore.getState().isVocalMuted).toBe(false);
    });

    it('1.2: setVocalLevel clamps values safely between 0 and 100', () => {
      const store = usePlayerStore.getState();

      store.setVocalLevel(40);
      expect(usePlayerStore.getState().vocalLevel).toBe(40);

      store.setVocalLevel(0);
      expect(usePlayerStore.getState().vocalLevel).toBe(0);

      store.setVocalLevel(100);
      expect(usePlayerStore.getState().vocalLevel).toBe(100);

      store.setVocalLevel(-20);
      expect(usePlayerStore.getState().vocalLevel).toBe(0);

      store.setVocalLevel(150);
      expect(usePlayerStore.getState().vocalLevel).toBe(100);
    });

    it('1.3: track with pre-separated karaoke stems loads stems automatically', async () => {
      const trackWithStems: Track = {
        id: 'test-karaoke-1',
        title: 'Sing Song',
        artist: 'Spotibai Star',
        album: 'Sing Album',
        duration: 180,
        streamUrl: '/audio/sing_song.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
        karaokeStems: {
          vocalsUrl: '/stems/test-karaoke-1/vocals.mp3',
          instrumentalUrl: '/stems/test-karaoke-1/instrumental.mp3',
          isReady: true,
        },
      };

      const store = usePlayerStore.getState();
      await store.playTrack(trackWithStems, [trackWithStems]);

      expect(usePlayerStore.getState().currentTrack?.id).toBe('test-karaoke-1');
      expect(usePlayerStore.getState().karaokeStatus).toBe('ready');
      expect(usePlayerStore.getState().karaokeStatusText).toBe('Karaoke Ready ✓');
    });
  });

  describe('2. Progressive Karaoke Lyrics & Word-level Highlighting', () => {
    it('2.1: parseLrc parses enhanced word timestamps progressive format', () => {
      const enhancedLrc = `
[00:05.00]Hello world
[00:10.00]<00:10.00> I <00:10.50> want <00:11.00> to <00:11.50> sing <00:12.00> with <00:12.50> you
[00:15.00]End of song
      `;

      const parsed = lyricsService.parseLrc(enhancedLrc);
      expect(parsed.length).toBe(3);

      const karaokeLine = parsed[1];
      expect(karaokeLine.timeMs).toBe(10000);
      expect(karaokeLine.words).toBeDefined();
      expect(karaokeLine.words?.length).toBe(6);
      expect(karaokeLine.words?.[0].text).toBe('I');
      expect(karaokeLine.words?.[0].timeMs).toBe(10000);
      expect(karaokeLine.words?.[3].text).toBe('sing');
      expect(karaokeLine.words?.[3].timeMs).toBe(11500);
    });

    it('2.2: parseLrc falls back to smooth word distribution for standard LRC lines', () => {
      const standardLrc = `
[00:00.00]First line
[00:04.00]Singing with my friends tonight
[00:08.00]Ending line
      `;

      const parsed = lyricsService.parseLrc(standardLrc);
      expect(parsed.length).toBe(3);

      const line = parsed[1];
      expect(line.words).toBeDefined();
      expect(line.words?.length).toBe(5);
      expect(line.words?.[0].text).toBe('Singing');
      expect(line.words?.[0].timeMs).toBe(4000);
      // Words are distributed smoothly between 4s and 8s
      expect(line.words?.[4].timeMs).toBeGreaterThan(4000);
      expect(line.words?.[4].timeMs).toBeLessThanOrEqual(8000);
    });
  });

  describe('3. Karaoke Service & Fallback Robustness', () => {
    it('3.1: getStemUrls uses cache or existing track stems', async () => {
      const track: Track = {
        id: 'cached-track-123',
        title: 'Cached Track',
        artist: 'Artist',
        album: 'Album',
        duration: 200,
        streamUrl: '/audio/test.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
        karaokeStems: {
          vocalsUrl: '/stems/cached-track-123/vocals.mp3',
          instrumentalUrl: '/stems/cached-track-123/instrumental.mp3',
        },
      };

      const stems = await karaokeService.getStemUrls(track);
      expect(stems).not.toBeNull();
      expect(stems?.vocals).toBe('/stems/cached-track-123/vocals.mp3');
      expect(stems?.instrumental).toBe('/stems/cached-track-123/instrumental.mp3');
    });

    it('3.2: separation failure handles gracefully without breaking player', async () => {
      const track: Track = {
        id: 'fail-track-999',
        title: 'Unseparable Track',
        artist: 'Unknown',
        album: 'Unknown',
        duration: 100,
        streamUrl: 'https://invalid-host-unreachable-audio.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
      };

      // Mock fetch to simulate offline / unavailable separation server
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Backend offline'));

      try {
        const stems = await karaokeService.getStemUrls(track);
        // Returns null cleanly instead of throwing uncaught rejection
        expect(stems).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
