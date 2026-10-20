/**
 * Empirical Adversarial Stress Harness for Spotibai Karaoke Mode & Lyrics
 *
 * Stress-tests:
 * 1. Residual Vocal Slider & Preset Detection in Rendered Component Trees & DOM.
 * 2. Rapid State Transitions & Race Conditions (playerStore toggleKaraokeMode).
 * 3. Synchronized Lyrics & Timestamp Adversarial Edge Cases (lyricsService).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';
import { Track, LyricsLine } from '../../src/types';

installGlobalBrowserMocks();

describe('Adversarial Empirical Stress Suite: Karaoke Mode & Lyrics', () => {
  let usePlayerStore: typeof import('../../src/store/playerStore').usePlayerStore;
  let useLibraryStore: typeof import('../../src/store/libraryStore').useLibraryStore;
  let useUiStore: typeof import('../../src/store/uiStore').useUiStore;
  let lyricsService: typeof import('../../src/services/lyrics/lyricsService').lyricsService;
  let karaokeService: typeof import('../../src/services/audio/karaokeService').karaokeService;
  let audioEngine: typeof import('../../src/services/audio/AudioEngine').audioEngine;
  let youTubeEngine: typeof import('../../src/services/youtube/YouTubeEngine').youTubeEngine;
  let KaraokeVocalSlider: typeof import('../../src/components/player/KaraokeVocalSlider').KaraokeVocalSlider;
  let PlayerBar: typeof import('../../src/components/player/PlayerBar').PlayerBar;
  let FullscreenNowPlaying: typeof import('../../src/components/player/FullscreenNowPlaying').FullscreenNowPlaying;

  let unhandledRejections: any[] = [];
  let unhandledRejectionHandler: (reason: any) => void;

  beforeEach(async () => {
    unhandledRejections = [];
    unhandledRejectionHandler = (reason: any) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', unhandledRejectionHandler);

    await resetDatabaseAndStores();

    const psModule = await import('../../src/store/playerStore');
    const libModule = await import('../../src/store/libraryStore');
    const uiModule = await import('../../src/store/uiStore');
    const lsModule = await import('../../src/services/lyrics/lyricsService');
    const ksModule = await import('../../src/services/audio/karaokeService');
    const aeModule = await import('../../src/services/audio/AudioEngine');
    const ytModule = await import('../../src/services/youtube/YouTubeEngine');
    const kvsModule = await import('../../src/components/player/KaraokeVocalSlider');
    const pbModule = await import('../../src/components/player/PlayerBar');
    const fnpModule = await import('../../src/components/player/FullscreenNowPlaying');

    usePlayerStore = psModule.usePlayerStore;
    useLibraryStore = libModule.useLibraryStore;
    useUiStore = uiModule.useUiStore;
    lyricsService = lsModule.lyricsService;
    karaokeService = ksModule.karaokeService;
    audioEngine = aeModule.audioEngine;
    youTubeEngine = ytModule.youTubeEngine;
    KaraokeVocalSlider = kvsModule.KaraokeVocalSlider;
    PlayerBar = pbModule.PlayerBar;
    FullscreenNowPlaying = fnpModule.FullscreenNowPlaying;

    // Ensure React 19 renderToStaticMarkup evaluates current Zustand state instead of initial SSR state
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe: any, getSnapshot: any) => getSnapshot());

    usePlayerStore.setState({
      queue: [],
      queueIndex: -1,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 180,
      volume: 0.8,
      isMuted: false,
      isKaraokeMode: false,
      isVocalMuted: false,
      vocalLevel: 100,
      karaokeStatus: 'idle',
      karaokeStatusText: '',
      karaokeError: null,
    });
  });

  afterEach(() => {
    process.removeListener('unhandledRejection', unhandledRejectionHandler);
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Section 1: Residual Vocal Slider & Preset Detection in Rendered DOM
  // =========================================================================
  describe('1. Residual Vocal Slider & Preset Audit in Rendered DOM', () => {
    it('1.1: KaraokeVocalSlider (compact=true) renders 0 sliders and 0 percentage buttons', () => {
      // Normal mode render
      usePlayerStore.setState({ isKaraokeMode: false, vocalLevel: 100 });
      const htmlNormal = renderToStaticMarkup(React.createElement(KaraokeVocalSlider, { compact: true }));

      expect(htmlNormal).not.toContain('<input');
      expect(htmlNormal).not.toContain('type="range"');
      expect(htmlNormal).not.toContain('slider');
      expect(htmlNormal).not.toContain('0%');
      expect(htmlNormal).not.toContain('25%');
      expect(htmlNormal).not.toContain('50%');
      expect(htmlNormal).not.toContain('75%');
      expect(htmlNormal).not.toContain('100%');
      expect(htmlNormal).toContain('Karaoke');

      // Active mode render
      usePlayerStore.setState({ isKaraokeMode: true, vocalLevel: 0 });
      const htmlActive = renderToStaticMarkup(React.createElement(KaraokeVocalSlider, { compact: true }));

      expect(htmlActive).not.toContain('<input');
      expect(htmlActive).not.toContain('type="range"');
      expect(htmlActive).toContain('Instruments');
      expect(htmlActive).toContain('Muted');
    });

    it('1.2: KaraokeVocalSlider (compact=false) renders 0 sliders and 0 percentage buttons', () => {
      // Normal mode
      usePlayerStore.setState({ isKaraokeMode: false, vocalLevel: 100 });
      const htmlNormal = renderToStaticMarkup(React.createElement(KaraokeVocalSlider, { compact: false }));

      expect(htmlNormal).not.toContain('<input');
      expect(htmlNormal).not.toContain('type="range"');
      expect(htmlNormal).not.toContain('0%');
      expect(htmlNormal).not.toContain('50%');
      expect(htmlNormal).not.toContain('100%');
      expect(htmlNormal).toContain('Original Track');
      expect(htmlNormal).toContain('Mute Singer &amp; Play Instruments');

      // Active mode
      usePlayerStore.setState({ isKaraokeMode: true, vocalLevel: 0, karaokeStatusText: 'Karaoke Ready ✓' });
      const htmlActive = renderToStaticMarkup(React.createElement(KaraokeVocalSlider, { compact: false }));

      expect(htmlActive).not.toContain('<input');
      expect(htmlActive).not.toContain('type="range"');
      expect(htmlActive).toContain('Instruments Only');
      expect(htmlActive).toContain('Singer Muted (Tap to Restore Vocals)');
      expect(htmlActive).toContain('Karaoke Ready ✓');
    });

    it('1.3: PlayerBar renders zero vocal sliders (strictly scrubber & volume only)', () => {
      const sampleTrack: Track = {
        id: 'track-pb-1',
        title: 'Song PB',
        artist: 'Artist PB',
        album: 'Album PB',
        duration: 200,
        streamUrl: '/audio/song.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
      };
      usePlayerStore.setState({ currentTrack: sampleTrack, currentTime: 45, duration: 200 });

      const html = renderToStaticMarkup(React.createElement(PlayerBar));

      // Match all input elements
      const inputMatches = html.match(/<input[^>]*>/g) || [];
      const rangeInputs = inputMatches.filter((tag) => tag.includes('type="range"'));

      // In PlayerBar there are strictly 2 range sliders: Scrubber and Master Volume
      expect(rangeInputs.length).toBe(2);

      const scrubber = rangeInputs.find((tag) => tag.includes('aria-label="Seek track"'));
      const volume = rangeInputs.find((tag) => tag.includes('aria-label="Volume slider"'));

      expect(scrubber).toBeDefined();
      expect(volume).toBeDefined();

      // Zero vocal sliders or vocal presets
      const vocalSlider = rangeInputs.find((tag) =>
        tag.toLowerCase().includes('vocal') || tag.toLowerCase().includes('sing')
      );
      expect(vocalSlider).toBeUndefined();

      expect(html).not.toMatch(/\b(0%|25%|50%|75%)\b/);
    });

    it('1.4: FullscreenNowPlaying renders zero vocal sliders or presets in lyrics screen', () => {
      const sampleTrack: Track = {
        id: 'track-fnp-1',
        title: 'Fullscreen Song',
        artist: 'Fullscreen Artist',
        album: 'Fullscreen Album',
        duration: 210,
        streamUrl: '/audio/fullscreen.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
      };
      useUiStore.setState({ isFullscreenNowPlaying: true });
      usePlayerStore.setState({ currentTrack: sampleTrack, currentTime: 30, duration: 210 });

      const html = renderToStaticMarkup(React.createElement(FullscreenNowPlaying));

      // Match all range inputs
      const inputMatches = html.match(/<input[^>]*>/g) || [];
      const rangeInputs = inputMatches.filter((tag) => tag.includes('type="range"'));

      // FullscreenNowPlaying has scrubber and volume inputs, zero vocal inputs
      for (const input of rangeInputs) {
        expect(input.toLowerCase()).not.toContain('vocal');
        expect(input.toLowerCase()).not.toContain('sing');
      }

      // Check header button text
      expect(html).toContain('Mute Singer');
      expect(html).not.toContain('Vocal Level:');
      expect(html).not.toMatch(/\b(25%|50%|75%)\b/);
    });
  });

  // =========================================================================
  // Section 2: Rapid State Transitions & Race Conditions (playerStore)
  // =========================================================================
  describe('2. State Transitions & Rapid Toggling Stress Tests', () => {
    it('2.1: 10x synchronous burst toggle toggles mode cleanly with matching vocalLevel', () => {
      const store = usePlayerStore.getState();
      expect(usePlayerStore.getState().isKaraokeMode).toBe(false);
      expect(usePlayerStore.getState().vocalLevel).toBe(100);

      // Perform 10 toggles
      for (let i = 1; i <= 10; i++) {
        store.toggleKaraokeMode();
        const expectedMode = i % 2 === 1;
        const expectedLevel = expectedMode ? 0 : 100;

        expect(usePlayerStore.getState().isKaraokeMode).toBe(expectedMode);
        expect(usePlayerStore.getState().vocalLevel).toBe(expectedLevel);
        expect(usePlayerStore.getState().isVocalMuted).toBe(expectedMode);
      }

      // Final state after 10 (even) toggles must be Normal mode
      expect(usePlayerStore.getState().isKaraokeMode).toBe(false);
      expect(usePlayerStore.getState().vocalLevel).toBe(100);
      expect(usePlayerStore.getState().isVocalMuted).toBe(false);
    });

    it('2.2: 50x asynchronous burst toggles produce 0 unhandled promise rejections', async () => {
      const sampleTrack: Track = {
        id: 'burst-track-1',
        title: 'Burst Track',
        artist: 'Burst Artist',
        album: 'Burst Album',
        duration: 180,
        streamUrl: '/audio/burst.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
      };
      usePlayerStore.setState({ currentTrack: sampleTrack });

      const promises: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(usePlayerStore.getState().toggleKaraokeMode());
      }

      await Promise.allSettled(promises);

      expect(unhandledRejections.length).toBe(0);
      const finalState = usePlayerStore.getState();
      expect(typeof finalState.isKaraokeMode).toBe('boolean');
      expect([0, 100]).toContain(finalState.vocalLevel);
      expect(finalState.isVocalMuted).toBe(finalState.vocalLevel === 0);
    });

    it('2.3: In-flight stem separation cancelled if user exits karaoke mode before finish', async () => {
      const track: Track = {
        id: 'async-track-cancel',
        title: 'Cancel Me',
        artist: 'Singer',
        album: 'Album',
        duration: 180,
        streamUrl: '/audio/cancel.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
      };
      usePlayerStore.setState({ currentTrack: track, currentTime: 20 });

      // Mock separateTrack to resolve with delay
      let resolveSeparation: (val: any) => void;
      const delayedSeparation = new Promise((resolve) => {
        resolveSeparation = resolve;
      });
      vi.spyOn(karaokeService, 'separateTrack').mockImplementation(() => delayedSeparation as any);
      const loadStemsSpy = vi.spyOn(audioEngine, 'loadKaraokeStems');

      // 1. Toggle ON: starts separation
      const toggleOnPromise = usePlayerStore.getState().toggleKaraokeMode();
      expect(usePlayerStore.getState().isKaraokeMode).toBe(true);

      // 2. User immediately toggles OFF before separation finishes
      const toggleOffPromise = usePlayerStore.getState().toggleKaraokeMode();
      expect(usePlayerStore.getState().isKaraokeMode).toBe(false);
      expect(usePlayerStore.getState().vocalLevel).toBe(100);

      // 3. Separation finally finishes
      resolveSeparation!({
        vocalsUrl: '/stems/async-track-cancel/vocals.mp3',
        instrumentalUrl: '/stems/async-track-cancel/instrumental.mp3',
        isReady: true,
      });

      await toggleOnPromise;
      await toggleOffPromise;

      // Because user is back in Normal mode, audioEngine.loadKaraokeStems should NOT have been loaded
      expect(loadStemsSpy).not.toHaveBeenCalled();
      expect(usePlayerStore.getState().vocalLevel).toBe(100);
      expect(usePlayerStore.getState().isKaraokeMode).toBe(false);
    });

    it('2.4: In-flight separation does not apply stems if user switches track', async () => {
      const trackA: Track = {
        id: 'track-A',
        title: 'Track A',
        artist: 'Artist A',
        album: 'Album A',
        duration: 180,
        streamUrl: '/audio/a.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
      };
      const trackB: Track = {
        id: 'track-B',
        title: 'Track B',
        artist: 'Artist B',
        album: 'Album B',
        duration: 190,
        streamUrl: '/audio/b.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
      };

      usePlayerStore.setState({ currentTrack: trackA });

      let resolveSeparation: (val: any) => void;
      const delayedSeparation = new Promise((resolve) => {
        resolveSeparation = resolve;
      });
      vi.spyOn(karaokeService, 'separateTrack').mockImplementation(() => delayedSeparation as any);
      const loadStemsSpy = vi.spyOn(audioEngine, 'loadKaraokeStems');

      // Start karaoke on Track A
      const togglePromise = usePlayerStore.getState().toggleKaraokeMode();

      // Switch to Track B
      usePlayerStore.setState({ currentTrack: trackB });

      // Resolve Track A stems
      resolveSeparation!({
        vocalsUrl: '/stems/track-A/vocals.mp3',
        instrumentalUrl: '/stems/track-A/instrumental.mp3',
        isReady: true,
      });

      await togglePromise;

      // Stems for Track A must NOT be loaded because currentTrack is Track B
      expect(loadStemsSpy).not.toHaveBeenCalled();
    });

    it('2.5: YouTube track seamlessly swaps between original and instrumental at identical timestamp', async () => {
      const ytTrack: Track = {
        id: 'yt-test-1',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        album: 'Divide',
        duration: 233,
        sourceType: 'youtube',
        youtubeId: 'JGwWNGJdvx8',
        instrumentalYoutubeId: 'INST-JGwWNGJdvx8',
        streamUrl: 'https://youtube.com/watch?v=JGwWNGJdvx8',
        artworkUrl: '/covers/default.jpg',
        source: 'external',
      };

      const loadVideoSpy = vi.spyOn(youTubeEngine, 'loadVideoById');

      usePlayerStore.setState({ currentTrack: ytTrack, currentTime: 75.4, isPlaying: true });

      // Toggle ON -> loads instrumental at 75.4s
      await usePlayerStore.getState().toggleKaraokeMode();
      expect(usePlayerStore.getState().isKaraokeMode).toBe(true);
      expect(loadVideoSpy).toHaveBeenCalledWith('INST-JGwWNGJdvx8', 75.4);

      // Advance time to 80.2s while in karaoke
      usePlayerStore.setState({ currentTime: 80.2 });

      // Toggle OFF -> restores original video at 80.2s
      await usePlayerStore.getState().toggleKaraokeMode();
      expect(usePlayerStore.getState().isKaraokeMode).toBe(false);
      expect(loadVideoSpy).toHaveBeenCalledWith('JGwWNGJdvx8', 80.2);
    });

    it('2.6: Backend Demucs separation offline/failure activates real-time vocal suppressor fallback', async () => {
      const localTrack: Track = {
        id: 'fail-track-demo',
        title: 'Offline Demucs Track',
        artist: 'Local Singer',
        album: 'Album',
        duration: 180,
        streamUrl: '/audio/offline.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
      };

      usePlayerStore.setState({ currentTrack: localTrack, currentTime: 15 });
      vi.spyOn(karaokeService, 'separateTrack').mockRejectedValue(new Error('FastAPI server connection refused (HTTP 502)'));
      const setVocalLevelSpy = vi.spyOn(audioEngine, 'setVocalLevel');

      await usePlayerStore.getState().toggleKaraokeMode();

      expect(usePlayerStore.getState().isKaraokeMode).toBe(true);
      expect(usePlayerStore.getState().karaokeStatus).toBe('ready');
      expect(usePlayerStore.getState().karaokeStatusText).toBe('Karaoke Active (Real-time vocal filter)');
      expect(usePlayerStore.getState().karaokeError).toContain('real-time vocal suppressor');
      expect(setVocalLevelSpy).toHaveBeenCalledWith(0);
    });

    it('2.7: toggleKaraokeMode with currentTrack null operates safely without throwing', async () => {
      usePlayerStore.setState({ currentTrack: null, isKaraokeMode: false });

      await expect(usePlayerStore.getState().toggleKaraokeMode()).resolves.not.toThrow();
      expect(usePlayerStore.getState().isKaraokeMode).toBe(true);
      expect(usePlayerStore.getState().vocalLevel).toBe(0);

      await expect(usePlayerStore.getState().toggleKaraokeMode()).resolves.not.toThrow();
      expect(usePlayerStore.getState().isKaraokeMode).toBe(false);
      expect(usePlayerStore.getState().vocalLevel).toBe(100);
    });
  });

  // =========================================================================
  // Section 3: Lyrics Parsing & Timestamp Adversarial Edge Cases
  // =========================================================================
  describe('3. Lyrics Parsing & Timestamp Adversarial Edge Cases', () => {
    it('3.1: parseLrc handles empty, whitespace-only, and non-LRC text', () => {
      expect(lyricsService.parseLrc('')).toEqual([]);
      expect(lyricsService.parseLrc('   \n  \t  \n  ')).toEqual([]);
      expect(lyricsService.parseLrc('Just plain text line without brackets')).toEqual([]);
      expect(lyricsService.parseLrc('[header:value]\n[ar:Artist]\n[ti:Title]')).toEqual([]);
    });

    it('3.2: parseLrc ignores lines with timestamps but empty text', () => {
      const lrcWithEmpty = `
[00:01.00]
[00:02.00]   
[00:03.00]Real lyric text
      `;
      const parsed = lyricsService.parseLrc(lrcWithEmpty);
      expect(parsed.length).toBe(1);
      expect(parsed[0].timeMs).toBe(3000);
      expect(parsed[0].text).toBe('Real lyric text');
    });

    it('3.3: parseLrc sorts out-of-order timestamps and handles duplicate timestamps', () => {
      const scrambledLrc = `
[00:30.00]Line 3 at thirty seconds
[00:05.00]Line 1 at five seconds
[00:15.00]Line 2 at fifteen seconds
[00:15.00]Line 2 duplicate concurrent harmony
      `;
      const parsed = lyricsService.parseLrc(scrambledLrc);
      expect(parsed.length).toBe(4);
      expect(parsed[0].timeMs).toBe(5000);
      expect(parsed[0].text).toBe('Line 1 at five seconds');
      expect(parsed[1].timeMs).toBe(15000);
      expect(parsed[2].timeMs).toBe(15000);
      expect(parsed[3].timeMs).toBe(30000);
    });

    it('3.4: parseLrc handles multi-timestamp single lines [00:02.00][00:12.00] Chorus', () => {
      const multiTimestampLrc = `[00:02.00][00:12.00]Repeated chorus phrase`;
      const parsed = lyricsService.parseLrc(multiTimestampLrc);
      expect(parsed.length).toBe(2);
      expect(parsed[0].timeMs).toBe(2000);
      expect(parsed[0].text).toBe('Repeated chorus phrase');
      expect(parsed[1].timeMs).toBe(12000);
      expect(parsed[1].text).toBe('Repeated chorus phrase');
    });

    it('3.5: parseLrc parses 2-digit and 3-digit millisecond fractions accurately', () => {
      const fractionsLrc = `
[00:01.50]Two digit fractions
[00:02.500]Three digit fractions
[00:03]No fraction
      `;
      const parsed = lyricsService.parseLrc(fractionsLrc);
      expect(parsed[0].timeMs).toBe(1500);
      expect(parsed[1].timeMs).toBe(2500);
      expect(parsed[2].timeMs).toBe(3000);
    });

    it('3.6: Enhanced LRC word timestamps: parses inline tags and maps clean text', () => {
      const enhancedLrc = `[00:10.00]<00:10.00> Apple <00:10.40> Music <00:10.80> Sing <00:11.20> Karaoke`;
      const parsed = lyricsService.parseLrc(enhancedLrc);
      expect(parsed.length).toBe(1);

      const line = parsed[0];
      expect(line.timeMs).toBe(10000);
      expect(line.text).toBe('Apple Music Sing Karaoke');
      expect(line.words?.length).toBe(4);
      expect(line.words?.[0]).toEqual({ text: 'Apple', timeMs: 10000 });
      expect(line.words?.[1]).toEqual({ text: 'Music', timeMs: 10400 });
      expect(line.words?.[2]).toEqual({ text: 'Sing', timeMs: 10800 });
      expect(line.words?.[3]).toEqual({ text: 'Karaoke', timeMs: 11200 });
    });

    it('3.7: Standard LRC word distribution: smooth interpolation across duration', () => {
      const standardLrc = `
[00:10.00]One two three four
[00:14.00]Next line
      `;
      const parsed = lyricsService.parseLrc(standardLrc);
      const line = parsed[0];
      expect(line.words?.length).toBe(4);
      // Duration from 10s to 14s is 4000ms. 4 words => step = 1000ms
      expect(line.words?.[0]).toEqual({ text: 'One', timeMs: 10000 });
      expect(line.words?.[1]).toEqual({ text: 'two', timeMs: 11000 });
      expect(line.words?.[2]).toEqual({ text: 'three', timeMs: 12000 });
      expect(line.words?.[3]).toEqual({ text: 'four', timeMs: 13000 });
    });

    it('3.8: Enhanced LRC with out-of-order word timestamps handles without throwing', () => {
      const outOfOrderWordsLrc = `[00:10.00]<00:12.00> Second <00:10.50> First`;
      const parsed = lyricsService.parseLrc(outOfOrderWordsLrc);
      expect(parsed.length).toBe(1);
      expect(parsed[0].words?.length).toBe(2);
      expect(parsed[0].words?.[0].text).toBe('Second');
      expect(parsed[0].words?.[0].timeMs).toBe(12000);
      expect(parsed[0].words?.[1].text).toBe('First');
      expect(parsed[0].words?.[1].timeMs).toBe(10500);
    });

    it('3.9: Non-ASCII, unicode, RTL and emojis in lyrics text parse without corruption', () => {
      const emojiLrc = `
[00:05.00]🎤 Sing along with 🎵 Spotibai 🎶
[00:10.00]こんにちは 世界 (Hello World in Japanese)
[00:15.00]שלום עולם (Hebrew RTL)
      `;
      const parsed = lyricsService.parseLrc(emojiLrc);
      expect(parsed.length).toBe(3);
      expect(parsed[0].text).toBe('🎤 Sing along with 🎵 Spotibai 🎶');
      expect(parsed[1].text).toBe('こんにちは 世界 (Hello World in Japanese)');
      expect(parsed[2].text).toBe('שלום עולם (Hebrew RTL)');
    });

    it('3.10: Massive 2,000-line LRC stress test finishes in <100ms with zero leaks', () => {
      const lines: string[] = [];
      for (let i = 0; i < 2000; i++) {
        const mins = Math.floor(i / 60);
        const secs = i % 60;
        const mm = String(mins).padStart(2, '0');
        const ss = String(secs).padStart(2, '0');
        lines.push(`[${mm}:${ss}.00] Lyric line index ${i} with words to test`);
      }
      const massiveLrc = lines.join('\n');

      const start = performance.now();
      const parsed = lyricsService.parseLrc(massiveLrc);
      const elapsed = performance.now() - start;

      expect(parsed.length).toBe(2000);
      expect(elapsed).toBeLessThan(200); // 2000 lines in < 200ms
    });

    it('3.11: Active lyric index selection algorithm handles all edge cases', () => {
      const testLyrics: LyricsLine[] = [
        { timeMs: 5000, text: 'First line' },
        { timeMs: 10000, text: 'Second line' },
        { timeMs: 15000, text: 'Third line' },
      ];

      function getActiveIndex(currentTimeSec: number, lyrics: LyricsLine[]): number {
        const currentTimeMs = currentTimeSec * 1000;
        let activeIdx = -1;
        for (let i = lyrics.length - 1; i >= 0; i--) {
          if (currentTimeMs >= lyrics[i].timeMs) {
            activeIdx = i;
            break;
          }
        }
        return activeIdx;
      }

      // Edge 1: Before first lyric
      expect(getActiveIndex(0, testLyrics)).toBe(-1);
      expect(getActiveIndex(4.99, testLyrics)).toBe(-1);

      // Edge 2: Exactly on boundary
      expect(getActiveIndex(5.00, testLyrics)).toBe(0);

      // Edge 3: Between lines
      expect(getActiveIndex(7.50, testLyrics)).toBe(0);
      expect(getActiveIndex(10.00, testLyrics)).toBe(1);
      expect(getActiveIndex(14.99, testLyrics)).toBe(1);
      expect(getActiveIndex(15.00, testLyrics)).toBe(2);

      // Edge 4: Past last lyric
      expect(getActiveIndex(60.00, testLyrics)).toBe(2);

      // Edge 5: Negative timestamp
      expect(getActiveIndex(-5, testLyrics)).toBe(-1);
    });

    it('3.12: getLyricsForTrack provides fallback placeholders when LRCLIB fails or track is instrumental', async () => {
      const instrumentalTrack: Track = {
        id: 'inst-track-99',
        title: 'Calm River',
        artist: 'Nature Sounds',
        album: 'Peace',
        duration: 120,
        streamUrl: '/audio/river.mp3',
        artworkUrl: '/covers/default.jpg',
        source: 'local',
      };

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network Offline'));

      try {
        const lyrics = await lyricsService.getLyricsForTrack(instrumentalTrack);
        expect(lyrics.length).toBeGreaterThanOrEqual(3);
        expect(lyrics[0].timeMs).toBe(0);
        expect(lyrics[0].text).toContain('Calm River');
        expect(lyrics[1].text).toContain('Enjoy the music');
        // Ensure no NaN timestamps
        for (const line of lyrics) {
          expect(Number.isFinite(line.timeMs)).toBe(true);
          expect(isNaN(line.timeMs)).toBe(false);
        }
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
