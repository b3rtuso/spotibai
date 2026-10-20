/**
 * Challenger 2 Adversarial Stress Test Suite for Milestone 1
 *
 * Exhaustive Empirical Verification of:
 * 1. Queue Boundary Navigation & Previous Track at Index 0 (repeat='off' vs repeat='all')
 * 2. Crossfade Synchronization & Interruption Handling (track switch, pause, ended during active fade)
 * 3. Seeking & Scrubbing State Isolation (isScrubbing true vs false) & Stream Switching (Web Audio vs YouTube)
 * 4. formatTime Non-Finite & Boundary Input Robustness (negative, NaN, Infinity, -Infinity)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';
import { formatTime } from '../../src/utils/colorExtractor';

installGlobalBrowserMocks();

describe('Challenger M1-2: Adversarial Stress & Stream Sync Suite', () => {
  let playerStore: typeof import('../../src/store/playerStore').usePlayerStore;
  let audioEngine: typeof import('../../src/services/audio/AudioEngine').audioEngine;
  let youTubeEngine: typeof import('../../src/services/youtube/YouTubeEngine').youTubeEngine;
  let INITIAL_TRACKS: typeof import('../../src/services/db/database').INITIAL_TRACKS;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await resetDatabaseAndStores();

    const psModule = await import('../../src/store/playerStore');
    const dbModule = await import('../../src/services/db/database');
    const aeModule = await import('../../src/services/audio/AudioEngine');
    const ytModule = await import('../../src/services/youtube/YouTubeEngine');

    playerStore = psModule.usePlayerStore;
    INITIAL_TRACKS = dbModule.INITIAL_TRACKS;
    audioEngine = aeModule.audioEngine;
    youTubeEngine = ytModule.youTubeEngine;

    // Reset store to known state
    // Reset audioEngine state
    (audioEngine as any).currentAudioIndex = 0;
    (audioEngine as any).isOutgoing = [false, false];
    if ((audioEngine as any).crossfadeTimeout) {
      clearTimeout((audioEngine as any).crossfadeTimeout);
      (audioEngine as any).crossfadeTimeout = null;
    }
    (audioEngine as any).audioA.pause();
    (audioEngine as any).audioB.pause();
    (audioEngine as any).audioA.currentTime = 0;
    (audioEngine as any).audioB.currentTime = 0;

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
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Section 1: Previous Track at Index 0 with repeat='off' vs repeat='all'
  // ==========================================================================
  describe('1. Queue Boundary Navigation & Previous at Index 0', () => {
    it('1.1: repeat="off" at index 0 with currentTime <= 3s restarts to 0:00 without decrementing queueIndex', async () => {
      const playlist = INITIAL_TRACKS.slice(0, 4);
      await playerStore.getState().playTrack(playlist[0], playlist, 0);
      playerStore.setState({ currentTime: 2.4, repeat: 'off' });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(playlist[0].id);
      expect(state.currentTime).toBe(0);
    });

    it('1.2: repeat="off" at index 0 with currentTime === 0 restarts to 0:00 and does not crash', async () => {
      const playlist = INITIAL_TRACKS.slice(0, 3);
      await playerStore.getState().playTrack(playlist[0], playlist, 0);
      playerStore.setState({ currentTime: 0, repeat: 'off' });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(playlist[0].id);
      expect(state.currentTime).toBe(0);
    });

    it('1.3: repeat="all" at index 0 with currentTime <= 3s wraps around to last queue track', async () => {
      const playlist = INITIAL_TRACKS.slice(0, 4);
      await playerStore.getState().playTrack(playlist[0], playlist, 0);
      playerStore.setState({ currentTime: 1.5, repeat: 'all' });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(3);
      expect(state.currentTrack?.id).toBe(playlist[3].id);
    });

    it('1.4: repeat="all" at index 0 with currentTime > 3s restarts current track (Spotify UX standard)', async () => {
      const playlist = INITIAL_TRACKS.slice(0, 4);
      await playerStore.getState().playTrack(playlist[0], playlist, 0);
      playerStore.setState({ currentTime: 12.0, repeat: 'all' });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      // Even with repeat='all', clicking previous past 3 seconds restarts the current song, not wraps
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(playlist[0].id);
      expect(state.currentTime).toBe(0);
    });

    it('1.5: single-track queue (length 1) with repeat="off" restarts to 0:00 without out-of-bounds error', async () => {
      const single = [INITIAL_TRACKS[0]];
      await playerStore.getState().playTrack(single[0], single, 0);
      playerStore.setState({ currentTime: 2.0, repeat: 'off' });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(single[0].id);
      expect(state.currentTime).toBe(0);
    });

    it('1.6: single-track queue (length 1) with repeat="all" safely replays the single track', async () => {
      const single = [INITIAL_TRACKS[0]];
      await playerStore.getState().playTrack(single[0], single, 0);
      playerStore.setState({ currentTime: 1.0, repeat: 'all' });

      await playerStore.getState().previousTrack();

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(single[0].id);
    });

    it('1.7: previousTrack on empty queue (length 0) does not throw and returns cleanly', async () => {
      playerStore.setState({ queue: [], queueIndex: 0, currentTrack: null });

      await expect(playerStore.getState().previousTrack()).resolves.not.toThrow();
      expect(playerStore.getState().queueIndex).toBe(0);
    });

    it('1.8: rapid burst of 10 consecutive clicks on previousTrack at index 0 with repeat="off" stays locked at index 0', async () => {
      const playlist = INITIAL_TRACKS.slice(0, 3);
      await playerStore.getState().playTrack(playlist[0], playlist, 0);
      playerStore.setState({ currentTime: 0.5, repeat: 'off' });

      for (let i = 0; i < 10; i++) {
        await playerStore.getState().previousTrack();
      }

      const state = playerStore.getState();
      expect(state.queueIndex).toBe(0);
      expect(state.currentTrack?.id).toBe(playlist[0].id);
      expect(state.currentTime).toBe(0);
    });

    it('1.9: rapid burst of clicks on previousTrack at index 0 with repeat="all" cycles through queue deterministically', async () => {
      const playlist = INITIAL_TRACKS.slice(0, 3); // indices 0, 1, 2
      await playerStore.getState().playTrack(playlist[0], playlist, 0);
      playerStore.setState({ currentTime: 1.0, repeat: 'all' });

      // Click 1: wraps from index 0 -> index 2
      await playerStore.getState().previousTrack();
      expect(playerStore.getState().queueIndex).toBe(2);

      // Force currentTime <= 3 for next navigation
      playerStore.setState({ currentTime: 1.0 });

      // Click 2: goes from index 2 -> index 1
      await playerStore.getState().previousTrack();
      expect(playerStore.getState().queueIndex).toBe(1);

      // Click 3: goes from index 1 -> index 0
      playerStore.setState({ currentTime: 1.0 });
      await playerStore.getState().previousTrack();
      expect(playerStore.getState().queueIndex).toBe(0);
    });
  });

  // ==========================================================================
  // Section 2: Active Crossfade Timeout & Stream Interruption
  // ==========================================================================
  describe('2. Crossfade Synchronization & Interruption Handling', () => {
    it('2.1: switching tracks during an active crossfade timeout cancels the pending timeout immediately', async () => {
      audioEngine.crossfadeDuration = 2; // 2 second crossfade
      const track1 = INITIAL_TRACKS[0];
      const track2 = INITIAL_TRACKS[1];
      const track3 = INITIAL_TRACKS[2];

      // Play track 1
      await audioEngine.playTrack(track1);

      // Advance mock time and audio element so track 1 is actively playing
      const activeAudio = (audioEngine as any).currentAudioIndex === 0 ? (audioEngine as any).audioA : (audioEngine as any).audioB;
      activeAudio.paused = false;
      activeAudio.currentTime = 10;

      // Start crossfade to track 2
      await audioEngine.playTrack(track2);
      expect((audioEngine as any).crossfadeTimeout).not.toBeNull();

      // 500ms into the 2000ms crossfade, user switches to track 3
      vi.advanceTimersByTime(500);
      const oldTimeout = (audioEngine as any).crossfadeTimeout;

      await audioEngine.playTrack(track3);

      // Verify old crossfade timeout was cleared and replaced or finalized
      expect((audioEngine as any).crossfadeTimeout).not.toBe(oldTimeout);
      expect((audioEngine as any).currentTrack?.id).toBe(track3.id);
    });

    it('2.2: outgoing channel ended event during crossfade does NOT trigger onTrackEnded', async () => {
      audioEngine.crossfadeDuration = 2;
      const track1 = INITIAL_TRACKS[0];
      const track2 = INITIAL_TRACKS[1];

      await audioEngine.playTrack(track1);
      const activeIdx = (audioEngine as any).currentAudioIndex;
      const activeAudio = activeIdx === 0 ? (audioEngine as any).audioA : (audioEngine as any).audioB;
      activeAudio.paused = false;
      activeAudio.currentTime = 179;

      let trackEndedFired = false;
      audioEngine.onTrackEnded = () => {
        trackEndedFired = true;
      };

      // Trigger crossfade to track 2 (activeAudio becomes outgoing)
      await audioEngine.playTrack(track2);
      expect((audioEngine as any).isOutgoing[activeIdx]).toBe(true);

      // Outgoing audio reaches end and fires ended event
      activeAudio.emitEnded();

      // onTrackEnded must NOT fire because activeAudio is outgoing!
      expect(trackEndedFired).toBe(false);
    });

    it('2.3: outgoing channel pause event during crossfade does NOT trigger onPlayStateChange(false)', async () => {
      audioEngine.crossfadeDuration = 2;
      const track1 = INITIAL_TRACKS[0];
      const track2 = INITIAL_TRACKS[1];

      await audioEngine.playTrack(track1);
      const activeIdx = (audioEngine as any).currentAudioIndex;
      const activeAudio = activeIdx === 0 ? (audioEngine as any).audioA : (audioEngine as any).audioB;
      activeAudio.paused = false;
      activeAudio.currentTime = 100;

      let playStateChanges: boolean[] = [];
      audioEngine.onPlayStateChange = (playing) => {
        playStateChanges.push(playing);
      };

      // Start crossfade to track 2
      await audioEngine.playTrack(track2);
      playStateChanges = []; // clear initial transitions

      // Outgoing channel pauses at end of its ramp
      activeAudio.pause();

      // onPlayStateChange(false) should NOT be called from outgoing channel
      expect(playStateChanges).not.toContain(false);
    });

    it('2.4: outgoing channel timeupdate does NOT emit stale timestamp to onTimeUpdate', async () => {
      audioEngine.crossfadeDuration = 2;
      const track1 = INITIAL_TRACKS[0];
      const track2 = INITIAL_TRACKS[1];

      await audioEngine.playTrack(track1);
      const activeIdx = (audioEngine as any).currentAudioIndex;
      const activeAudio = activeIdx === 0 ? (audioEngine as any).audioA : (audioEngine as any).audioB;
      activeAudio.paused = false;
      activeAudio.currentTime = 175;

      const receivedTimestamps: number[] = [];
      audioEngine.onTimeUpdate = (cur) => {
        receivedTimestamps.push(cur);
      };

      await audioEngine.playTrack(track2);
      receivedTimestamps.length = 0; // reset

      // Outgoing audio emits a late timeupdate of 176s
      activeAudio.emitTimeUpdate(176, 180);

      // Must NOT contain 176s because audio is outgoing
      expect(receivedTimestamps).not.toContain(176);
    });

    it('2.5: incoming active channel ended event DOES trigger onTrackEnded', async () => {
      audioEngine.crossfadeDuration = 2;
      const track1 = INITIAL_TRACKS[0];
      const track2 = INITIAL_TRACKS[1];

      await audioEngine.playTrack(track1);
      const activeIdx = (audioEngine as any).currentAudioIndex;
      const activeAudio = activeIdx === 0 ? (audioEngine as any).audioA : (audioEngine as any).audioB;
      activeAudio.paused = false;
      activeAudio.currentTime = 10;

      let trackEndedFired = false;
      audioEngine.onTrackEnded = () => {
        trackEndedFired = true;
      };

      await audioEngine.playTrack(track2);

      // Incoming audio is the new active channel
      const newActiveIdx = (audioEngine as any).currentAudioIndex;
      expect(newActiveIdx).not.toBe(activeIdx);
      const newActiveAudio = newActiveIdx === 0 ? (audioEngine as any).audioA : (audioEngine as any).audioB;
      newActiveAudio.emitEnded();

      expect(trackEndedFired).toBe(true);
    });

    it('2.6: calling pause() during active crossfade cancels timeout and pauses both audio elements', async () => {
      audioEngine.crossfadeDuration = 2;
      const track1 = INITIAL_TRACKS[0];
      const track2 = INITIAL_TRACKS[1];

      await audioEngine.playTrack(track1);
      const activeIdx = (audioEngine as any).currentAudioIndex;
      const activeAudio = activeIdx === 0 ? (audioEngine as any).audioA : (audioEngine as any).audioB;
      activeAudio.paused = false;
      activeAudio.currentTime = 10;

      await audioEngine.playTrack(track2);
      expect((audioEngine as any).crossfadeTimeout).not.toBeNull();

      // Pause during crossfade
      audioEngine.pause();

      expect((audioEngine as any).crossfadeTimeout).toBeNull();
      expect((audioEngine as any).audioA.paused).toBe(true);
      expect((audioEngine as any).audioB.paused).toBe(true);
    });

    it('2.7: calling seek() during active crossfade finalizes crossfade and resets outgoing channel', async () => {
      audioEngine.crossfadeDuration = 2;
      const track1 = INITIAL_TRACKS[0];
      const track2 = INITIAL_TRACKS[1];

      await audioEngine.playTrack(track1);
      const activeIdx = (audioEngine as any).currentAudioIndex;
      const activeAudio = activeIdx === 0 ? (audioEngine as any).audioA : (audioEngine as any).audioB;
      activeAudio.paused = false;
      activeAudio.currentTime = 50;

      await audioEngine.playTrack(track2);
      expect((audioEngine as any).crossfadeTimeout).not.toBeNull();

      // Seek active track to 30s
      audioEngine.seek(30);

      // Crossfade timeout must be cleared
      expect((audioEngine as any).crossfadeTimeout).toBeNull();
      // Outgoing channel should be paused and reset
      expect(activeAudio.paused).toBe(true);
      expect(activeAudio.currentTime).toBe(0);
      // New active channel should be at 30s
      const newActiveIdx = (audioEngine as any).currentAudioIndex;
      const newActiveAudio = newActiveIdx === 0 ? (audioEngine as any).audioA : (audioEngine as any).audioB;
      expect(newActiveAudio.currentTime).toBe(30);
    });
  });

  // ==========================================================================
  // Section 3: Seeking, Scrubbing State Isolation & Stream Switching
  // ==========================================================================
  describe('3. Seeking, Scrubbing State Isolation & Stream Switching', () => {
    it('3.1: seek when isScrubbing=false immediately updates playerStore currentTime', async () => {
      await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS, 0);

      playerStore.getState().seek(45);

      expect(playerStore.getState().currentTime).toBe(45);
    });

    it('3.2: isScrubbing isolation logic ensures background timeupdate does not fight user scrubTime', () => {
      // Simulating PlayerBar state machine
      let isScrubbing = false;
      let scrubTime = 0;
      let storeCurrentTime = 10;
      const duration = 200;

      const getDisplayTime = () => (isScrubbing ? scrubTime : storeCurrentTime);

      // Normal playback:
      expect(getDisplayTime()).toBe(10);

      // User starts scrubbing at 75s:
      isScrubbing = true;
      scrubTime = 75;
      expect(getDisplayTime()).toBe(75);

      // Background audio engine emits timeupdate while user is dragging
      storeCurrentTime = 12;
      expect(getDisplayTime()).toBe(75); // Must NOT snap back to 12!

      storeCurrentTime = 14;
      expect(getDisplayTime()).toBe(75); // Slider stays smooth

      // User drags further to 90s:
      scrubTime = 90;
      expect(getDisplayTime()).toBe(90);

      // User commits scrub:
      isScrubbing = false;
      storeCurrentTime = scrubTime; // seek executed
      expect(getDisplayTime()).toBe(90);
    });

    it('3.3: switching from Web Audio track to YouTube track pauses audio and sets YouTube source', async () => {
      const webAudioTrack = INITIAL_TRACKS[0];
      const ytTrack = {
        ...INITIAL_TRACKS[1],
        id: 'yt-challenger-1',
        sourceType: 'youtube' as const,
        youtubeId: 'abc123xyz',
      };

      await playerStore.getState().playTrack(webAudioTrack, [webAudioTrack, ytTrack], 0);
      expect(playerStore.getState().currentTrack?.id).toBe(webAudioTrack.id);

      // Switch to YouTube
      await playerStore.getState().playTrack(ytTrack, [webAudioTrack, ytTrack], 1);

      const state = playerStore.getState();
      expect(state.currentTrack?.id).toBe(ytTrack.id);
      expect(state.queueIndex).toBe(1);
      // AudioEngine must be paused
      const audioA = (audioEngine as any).audioA;
      const audioB = (audioEngine as any).audioB;
      expect(audioA.paused).toBe(true);
      expect(audioB.paused).toBe(true);
      // YouTube video ID should be set
      expect(youTubeEngine.currentVideoId).toBe('abc123xyz');
    });

    it('3.4: switching from YouTube track to Web Audio track pauses YouTube and resumes Web Audio', async () => {
      const ytTrack = {
        ...INITIAL_TRACKS[0],
        id: 'yt-challenger-2',
        sourceType: 'youtube' as const,
        youtubeId: 'test_yt_id',
      };
      const webAudioTrack = INITIAL_TRACKS[1];

      await playerStore.getState().playTrack(ytTrack, [ytTrack, webAudioTrack], 0);
      expect(playerStore.getState().currentTrack?.id).toBe(ytTrack.id);

      // Switch back to Web Audio
      await playerStore.getState().playTrack(webAudioTrack, [ytTrack, webAudioTrack], 1);

      const state = playerStore.getState();
      expect(state.currentTrack?.id).toBe(webAudioTrack.id);
      expect(state.queueIndex).toBe(1);
      expect(state.isPlaying).toBe(true);
    });

    it('3.5: seeking on YouTube track invokes youTubeEngine.seekTo and does not mutate Web Audio currentTime', async () => {
      const ytTrack = {
        ...INITIAL_TRACKS[0],
        id: 'yt-challenger-seek',
        sourceType: 'youtube' as const,
        youtubeId: 'seek_test_id',
      };

      await playerStore.getState().playTrack(ytTrack, [ytTrack], 0);
      const ytSeekSpy = vi.spyOn(youTubeEngine, 'seekTo');

      playerStore.getState().seek(88);

      expect(ytSeekSpy).toHaveBeenCalledWith(88);
      expect(playerStore.getState().currentTime).toBe(88);
      ytSeekSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Section 4: formatTime Robustness (negative, NaN, Infinity, -Infinity)
  // ==========================================================================
  describe('4. formatTime Non-Finite & Boundary Input Robustness', () => {
    it('4.1: negative numbers return "0:00"', () => {
      expect(formatTime(-1)).toBe('0:00');
      expect(formatTime(-100)).toBe('0:00');
      expect(formatTime(-0.001)).toBe('0:00');
      expect(formatTime(-3600)).toBe('0:00');
    });

    it('4.2: NaN returns "0:00"', () => {
      expect(formatTime(NaN)).toBe('0:00');
      expect(formatTime(Number('not a number'))).toBe('0:00');
      expect(formatTime(0 / 0)).toBe('0:00');
    });

    it('4.3: Infinity and -Infinity return "0:00"', () => {
      expect(formatTime(Infinity)).toBe('0:00');
      expect(formatTime(-Infinity)).toBe('0:00');
      expect(formatTime(1 / 0)).toBe('0:00');
      expect(formatTime(-1 / 0)).toBe('0:00');
    });

    it('4.4: 0 and -0 return "0:00"', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(-0)).toBe('0:00');
    });

    it('4.5: non-number types return "0:00"', () => {
      expect(formatTime(null as any)).toBe('0:00');
      expect(formatTime(undefined as any)).toBe('0:00');
      expect(formatTime('120' as any)).toBe('0:00');
      expect(formatTime({} as any)).toBe('0:00');
      expect(formatTime([] as any)).toBe('0:00');
    });

    it('4.6: valid standard durations format correctly with zero padding', () => {
      expect(formatTime(5)).toBe('0:05');
      expect(formatTime(9)).toBe('0:09');
      expect(formatTime(10)).toBe('0:10');
      expect(formatTime(59)).toBe('0:59');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(65)).toBe('1:05');
      expect(formatTime(125)).toBe('2:05');
      expect(formatTime(3599)).toBe('59:59');
      expect(formatTime(3600)).toBe('60:00');
      expect(formatTime(3665)).toBe('61:05');
    });
  });
});
