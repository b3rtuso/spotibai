/**
 * Challenger 1 Adversarial Stress Test Suite for Milestone 1
 * Targets:
 * 1. Rapid play/pause toggling (50 rapid calls) - 0 uncaught promise rejections
 * 2. Previous track at boundary times: t=0.0s, t=2.99s, t=3.00s, t=3.01s, t=10.0s
 * 3. Scrubber range input seek with NaN, Infinity, -1, 999999, 0 + formatTime robustness
 * 4. Volume mute/unmute cycle with low volumes (0.05, 0.15) & linear gain verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';
import { formatTime } from '../../src/utils/colorExtractor';

installGlobalBrowserMocks();

describe('Challenger M1: Adversarial Stress & Boundary Suite', () => {
  let playerStore: typeof import('../../src/store/playerStore').usePlayerStore;
  let audioEngine: typeof import('../../src/services/audio/AudioEngine').audioEngine;
  let INITIAL_TRACKS: typeof import('../../src/services/db/database').INITIAL_TRACKS;
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
    const dbModule = await import('../../src/services/db/database');
    const aeModule = await import('../../src/services/audio/AudioEngine');

    playerStore = psModule.usePlayerStore;
    INITIAL_TRACKS = dbModule.INITIAL_TRACKS;
    audioEngine = aeModule.audioEngine;

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
  });

  afterEach(() => {
    process.off('unhandledRejection', unhandledRejectionHandler);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Section 1: Rapid Play/Pause Toggling (50 calls) & Promise Rejection Audit
  // ==========================================================================
  describe('Adversarial 1: Rapid Play/Pause Toggling & Rejections', () => {
    it('1.1: 50 concurrent rapid togglePlay() calls generate 0 uncaught promise rejections', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      const promises: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(playerStore.getState().togglePlay());
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(unhandledRejections).toHaveLength(0);

      // Verify state is clean and boolean
      expect(typeof playerStore.getState().isPlaying).toBe('boolean');
    });

    it('1.2: 50 sequential rapid togglePlay() calls complete with zero rejections and deterministic state', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);
      const initialPlaying = playerStore.getState().isPlaying; // true

      for (let i = 0; i < 50; i++) {
        await playerStore.getState().togglePlay();
      }

      // 50 toggles from true: 50 is even, so should return to true
      expect(playerStore.getState().isPlaying).toBe(initialPlaying);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('1.3: HTMLAudioElement play() throwing DOMException / AbortError is cleanly suppressed by safePlay', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

      // Simulate browser play() interruption
      const activeAudio = (audioEngine as any).audioA;
      const originalPlay = activeAudio.play;
      activeAudio.play = vi.fn().mockRejectedValue(
        new DOMException('The play() request was interrupted by a call to pause()', 'AbortError')
      );

      // Calling togglePlay when paused -> attempts play()
      playerStore.setState({ isPlaying: false });
      activeAudio.paused = true;

      await expect(playerStore.getState().togglePlay()).resolves.not.toThrow();
      expect(unhandledRejections).toHaveLength(0);

      activeAudio.play = originalPlay;
    });

    it('1.4: 50 rapid togglePlay() calls on YouTube stream track without uncaught rejections', async () => {
      const youtubeTrack = {
        ...INITIAL_TRACKS[0],
        id: 'yt-test-track',
        sourceType: 'youtube' as const,
        youtubeId: 'dQw4w9WgXcQ',
      };

      await playerStore.getState().playTrack(youtubeTrack, [youtubeTrack]);

      const promises: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(playerStore.getState().togglePlay());
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(unhandledRejections).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Section 2: Previous Track Boundary Condition Suite (0.0s, 2.99s, 3.01s, 10.0s)
  // ==========================================================================
  describe('Adversarial 2: Previous Track Boundary Times', () => {
    it('2.1: previousTrack at boundary t = 0.0s switches to previous track in queue', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS, 1);
      playerStore.setState({ currentTime: 0.0 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
    });

    it('2.2: previousTrack at boundary t = 2.99s switches to previous track in queue', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[2], INITIAL_TRACKS, 2);
      playerStore.setState({ currentTime: 2.99 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(1);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[1].id);
    });

    it('2.3: previousTrack at exact boundary t = 3.00s (<= 3s) switches to previous track in queue', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS, 1);
      playerStore.setState({ currentTime: 3.00 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
    });

    it('2.4: previousTrack at boundary t = 3.01s (> 3s) restarts current track to 0:00 without decrementing queueIndex', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS, 1);
      playerStore.setState({ currentTime: 3.01 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(1);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[1].id);
      expect(state.currentTime).toBe(0);
    });

    it('2.5: previousTrack at boundary t = 10.0s restarts current track to 0:00 without decrementing queueIndex', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[2], INITIAL_TRACKS, 2);
      playerStore.setState({ currentTime: 10.0 });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(2);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[2].id);
      expect(state.currentTime).toBe(0);
    });

    it('2.6: consecutive previous clicks: first restarts at t=10s, second switches track at t=0s', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[2], INITIAL_TRACKS, 2);
      playerStore.setState({ currentTime: 10.0 });

      // First click: restarts track
      await playerStore.getState().previousTrack();
      expect(playerStore.getState().queueIndex).toBe(2);
      expect(playerStore.getState().currentTime).toBe(0);

      // Second click: now at currentTime 0, should switch to index 1
      await playerStore.getState().previousTrack();
      expect(playerStore.getState().queueIndex).toBe(1);
      expect(playerStore.getState().currentTrack?.id).toBe(INITIAL_TRACKS[1].id);
    });

    it('2.7: previousTrack at t=0.0s on first track (queueIndex 0) with repeat "all" loops to last track', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS, 0);
      playerStore.setState({ currentTime: 0.0, repeat: 'all' });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(INITIAL_TRACKS.length - 1);
      expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[INITIAL_TRACKS.length - 1].id);
    });

    it('2.8: crossfade channel isolation prevents outgoing channel late timeupdate (>3s) from corrupting state', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS, 0);
      const audioA = (audioEngine as any).audioA;
      audioA.currentTime = 120.0; // Outgoing track was deep into playback

      // Switch to track 1 with crossfade
      audioEngine.crossfadeDuration = 2;
      await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS, 1);

      // Simulate outgoing channel audioA firing late timeupdate while crossfading
      audioA.emitTimeUpdate(121.0);

      // Channel isolation must prevent audioA's time from leaking to playerStore.currentTime
      expect(playerStore.getState().currentTime).toBeLessThan(3.0);
    });
  });

  // ==========================================================================
  // Section 3: Scrubber Seek with NaN, Infinity, -1, 999999, 0 & formatTime
  // ==========================================================================
  describe('Adversarial 3: Scrubber Range Input Seek & formatTime', () => {
    it('3.1: seek(NaN) does not throw and clamps currentTime safely to 0', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS, 0);

      expect(() => playerStore.getState().seek(NaN)).not.toThrow();

      const state = playerStore.getState();
      expect(Number.isFinite(state.currentTime)).toBe(true);
      expect(state.currentTime).toBe(0);
    });

    it('3.2: seek(Infinity) does not throw and clamps currentTime to track duration', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS, 0);
      const trackDur = INITIAL_TRACKS[0].duration; // e.g. 154

      expect(() => playerStore.getState().seek(Infinity)).not.toThrow();

      const state = playerStore.getState();
      expect(Number.isFinite(state.currentTime)).toBe(true);
      expect(state.currentTime).toBeLessThanOrEqual(trackDur);
    });

    it('3.3: seek(-1) does not throw and clamps currentTime safely to 0', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS, 0);

      expect(() => playerStore.getState().seek(-1)).not.toThrow();

      const state = playerStore.getState();
      expect(state.currentTime).toBe(0);
    });

    it('3.4: seek(999999) does not throw and clamps currentTime to track duration', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS, 0);
      const trackDur = INITIAL_TRACKS[0].duration;

      expect(() => playerStore.getState().seek(999999)).not.toThrow();

      const state = playerStore.getState();
      expect(state.currentTime).toBeLessThanOrEqual(trackDur);
    });

    it('3.5: seek(0) accurately seeks to 0 without error', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS, 0);
      playerStore.setState({ currentTime: 50 });

      expect(() => playerStore.getState().seek(0)).not.toThrow();

      expect(playerStore.getState().currentTime).toBe(0);
    });

    it('3.6: formatTime handles adversarial values (NaN, Infinity, negatives, edge cases) cleanly', () => {
      expect(formatTime(NaN)).toBe('0:00');
      expect(formatTime(Infinity)).toBe('0:00');
      expect(formatTime(-Infinity)).toBe('0:00');
      expect(formatTime(-1)).toBe('0:00');
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(undefined as any)).toBe('0:00');
      expect(formatTime(null as any)).toBe('0:00');
      expect(formatTime('abc' as any)).toBe('0:00');

      // Valid timings
      expect(formatTime(65)).toBe('1:05');
      expect(formatTime(120)).toBe('2:00');
      expect(formatTime(3599)).toBe('59:59');
    });

    it('3.7: AudioEngine.seek does not crash when audio.duration is NaN (unloaded metadata)', () => {
      const activeAudio = (audioEngine as any).audioA;
      activeAudio.duration = NaN;

      expect(() => audioEngine.seek(45)).not.toThrow();
      expect(Number.isFinite(activeAudio.currentTime)).toBe(true);
    });

    it('3.8: MediaSession seekforward near track end clamps playerStore.currentTime to duration', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS, 0);
      const trackDur = INITIAL_TRACKS[0].duration;
      playerStore.setState({ currentTime: trackDur - 2 });

      // Simulate seeking forward past track duration
      playerStore.getState().seek(trackDur + 10);

      const state = playerStore.getState();
      expect(state.currentTime).toBeLessThanOrEqual(trackDur);
    });
  });

  // ==========================================================================
  // Section 4: Volume Mute/Unmute Cycle with Low Volumes (0.05, 0.15) & Linear Gain
  // ==========================================================================
  describe('Adversarial 4: Volume Mute/Unmute Cycle & Linear Scaling', () => {
    it('4.1: mute/unmute cycle at low volume 0.05 restores exact 0.05 (not 0.8 default)', () => {
      playerStore.getState().setVolume(0.05);
      expect(playerStore.getState().volume).toBeCloseTo(0.05, 5);
      expect(playerStore.getState().isMuted).toBe(false);

      // Mute
      playerStore.getState().toggleMute();
      expect(playerStore.getState().volume).toBe(0);
      expect(playerStore.getState().isMuted).toBe(true);

      // Unmute
      playerStore.getState().toggleMute();
      expect(playerStore.getState().volume).toBeCloseTo(0.05, 5);
      expect(playerStore.getState().isMuted).toBe(false);
    });

    it('4.2: mute/unmute cycle at low volume 0.15 restores exact 0.15 (not 0.8 default)', () => {
      playerStore.getState().setVolume(0.15);
      expect(playerStore.getState().volume).toBeCloseTo(0.15, 5);
      expect(playerStore.getState().isMuted).toBe(false);

      // Mute
      playerStore.getState().toggleMute();
      expect(playerStore.getState().volume).toBe(0);
      expect(playerStore.getState().isMuted).toBe(true);

      // Unmute
      playerStore.getState().toggleMute();
      expect(playerStore.getState().volume).toBeCloseTo(0.15, 5);
      expect(playerStore.getState().isMuted).toBe(false);
    });

    it('4.3: 10 consecutive rapid mute/unmute toggles consistently alternate and retain low volume', () => {
      playerStore.getState().setVolume(0.05);

      for (let i = 0; i < 10; i++) {
        playerStore.getState().toggleMute();
        if (i % 2 === 0) {
          // Odd iteration: muted
          expect(playerStore.getState().volume).toBe(0);
          expect(playerStore.getState().isMuted).toBe(true);
        } else {
          // Even iteration: unmuted
          expect(playerStore.getState().volume).toBeCloseTo(0.05, 5);
          expect(playerStore.getState().isMuted).toBe(false);
        }
      }
    });

    it('4.4: linear gain verification: AudioEngine masterGain is linear and audio elements remain 1.0', () => {
      (audioEngine as any).initAudioContext();
      audioEngine.setVolume(0.05);

      const masterGain = (audioEngine as any).masterGain;
      const audioA = (audioEngine as any).audioA;
      const audioB = (audioEngine as any).audioB;

      // Audio elements must remain at unity 1.0 to eliminate quadratic double attenuation (vol^2)
      expect(audioA.volume).toBe(1.0);
      expect(audioB.volume).toBe(1.0);

      // Master gain node must reflect linear volume
      if (masterGain) {
        expect(masterGain.gain.value).toBeCloseTo(0.05, 5);
      }
    });

    it('4.5: setVolume clamps out-of-bounds volumes (-0.5 and 1.5) without NaN', () => {
      playerStore.getState().setVolume(-0.5);
      expect(playerStore.getState().volume).toBe(0);
      expect(playerStore.getState().isMuted).toBe(true);

      playerStore.getState().setVolume(1.5);
      expect(playerStore.getState().volume).toBe(1.0);
      expect(playerStore.getState().isMuted).toBe(false);

      playerStore.getState().setVolume(NaN);
      expect(playerStore.getState().volume).toBe(0.8);
    });
  });
});
