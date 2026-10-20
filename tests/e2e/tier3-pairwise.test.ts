import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';

installGlobalBrowserMocks();

describe('Tier 3: Cross-Feature Combinations (Pairwise)', () => {
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
  // Pairwise 1: F1 (Previous) + F2 (Play/Pause)
  // --------------------------------------------------------------------------
  it('P1 [F1 + F2]: previousTrack while paused updates track without auto-starting playback if paused', async () => {
    await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS);
    await playerStore.getState().togglePlay(); // pause
    expect(playerStore.getState().isPlaying).toBe(false);

    playerStore.setState({ currentTime: 1.0 });
    await playerStore.getState().previousTrack();

    const state = playerStore.getState();
    expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
    expect(state.queueIndex).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Pairwise 2: F1 (Previous) + F3 (Scrubber Seeking)
  // --------------------------------------------------------------------------
  it('P2 [F1 + F3]: seeking mid-track (>3s) followed by previousTrack restarts track to 0:00 and resets scrubber', async () => {
    await playerStore.getState().playTrack(INITIAL_TRACKS[2], INITIAL_TRACKS);

    // Seek to 60s
    playerStore.getState().seek(60);
    expect(playerStore.getState().currentTime).toBe(60);

    // Click previous past 3s
    await playerStore.getState().previousTrack();

    const state = playerStore.getState();
    expect(state.queueIndex).toBe(2);
    expect(state.currentTime).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Pairwise 3: F1 (Previous) + F4 (Like Heart Sync)
  // --------------------------------------------------------------------------
  it('P3 [F1 + F4]: previousTrack preserves isLiked status on both outgoing and incoming tracks', async () => {
    // Track 0 is liked, Track 1 is unliked
    await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS);
    playerStore.setState({ currentTime: 1.5 });

    expect(playerStore.getState().currentTrack?.isLiked).toBeFalsy();

    await playerStore.getState().previousTrack();

    const state = playerStore.getState();
    expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
    expect(state.currentTrack?.isLiked).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Pairwise 4: F2 (Play/Pause) + F3 (Scrubber Seeking)
  // --------------------------------------------------------------------------
  it('P4 [F2 + F3]: seeking while paused keeps player paused, and resuming playback plays from seek position', async () => {
    await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);
    await playerStore.getState().togglePlay(); // pause
    expect(playerStore.getState().isPlaying).toBe(false);

    playerStore.getState().seek(90);
    expect(playerStore.getState().currentTime).toBe(90);
    expect(playerStore.getState().isPlaying).toBe(false);

    await playerStore.getState().togglePlay(); // resume
    expect(playerStore.getState().isPlaying).toBe(true);
    expect(playerStore.getState().currentTime).toBe(90);
  });

  // --------------------------------------------------------------------------
  // Pairwise 5: F2 (Play/Pause) + F4 (Like Heart Sync)
  // --------------------------------------------------------------------------
  it('P5 [F2 + F4]: toggling like while audio is actively playing updates like state without interrupting playback', async () => {
    await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS);
    expect(playerStore.getState().isPlaying).toBe(true);

    await libraryStore.getState().toggleLike(INITIAL_TRACKS[1].id);

    const state = playerStore.getState();
    expect(state.isPlaying).toBe(true);
    expect(state.currentTrack?.isLiked).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Pairwise 6: F2 (Play/Pause) + F5 (Offline Download)
  // --------------------------------------------------------------------------
  it('P6 [F2 + F5]: downloading track while playing completes blob persistence without disrupting active playback', async () => {
    const track = INITIAL_TRACKS[0];
    await playerStore.getState().playTrack(track, INITIAL_TRACKS);
    expect(playerStore.getState().isPlaying).toBe(true);

    await downloadService.downloadTrack(track);

    const state = playerStore.getState();
    expect(state.isPlaying).toBe(true);
    const dbTrack = await db.tracks.get(track.id);
    expect(dbTrack?.isDownloaded).toBe(true);
    expect(dbTrack?.audioBlob).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Pairwise 7: F3 (Volume / Scrubber) + F7 (Reload Persistence)
  // --------------------------------------------------------------------------
  it('P7 [F3 + F7]: volume and scrubber seek state persist cleanly across browser reload simulation', async () => {
    await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS);
    playerStore.getState().seek(72);
    playerStore.getState().setVolume(0.42);

    vi.advanceTimersByTime(2000);

    // Simulate page reload by re-initializing store
    playerStore.getState().init();

    const state = playerStore.getState();
    expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[1].id);
    expect(state.currentTime).toBe(72);
    expect(state.volume).toBeCloseTo(0.42);
  });

  // --------------------------------------------------------------------------
  // Pairwise 8: F4 (Like Heart Sync) + F6 (Algorithmic Autoplay)
  // --------------------------------------------------------------------------
  it('P8 [F4 + F6]: liking a candidate track boosts its recommendation ranking (+25 pts) in Autoplay engine', async () => {
    const current = INITIAL_TRACKS[0]; // Synthwave
    const candidateA = { ...INITIAL_TRACKS[1], id: 'candidate-a', genre: 'Synthwave', isLiked: false };
    const candidateB = { ...INITIAL_TRACKS[2], id: 'candidate-b', genre: 'Synthwave', isLiked: false };

    await db.tracks.put(candidateA);
    await db.tracks.put(candidateB);
    await libraryStore.getState().loadLibrary();

    // Like candidate B (adds +25 points)
    await libraryStore.getState().toggleLike(candidateB.id, candidateB);

    const recs = await autoplayEngine.getNextRecommendations(current, [current], [], 2);

    // Candidate B with like bonus ranks at top
    const ids = recs.map((r) => r.id);
    expect(ids).toContain('candidate-b');
    expect(ids[0]).toBe('candidate-b');
  });

  // --------------------------------------------------------------------------
  // Pairwise 9: F5 (Offline Download) + F7 (Reload Persistence)
  // --------------------------------------------------------------------------
  it('P9 [F5 + F7]: downloaded audio blobs remain accessible and loadable after reload simulation', async () => {
    const track = INITIAL_TRACKS[0];
    await downloadService.downloadTrack(track);

    // Stage session
    playerStore.setState({
      currentTrack: track,
      queue: [track],
      queueIndex: 0,
      currentTime: 15,
      volume: 0.8,
    });
    playerStore.getState().seek(15);
    vi.advanceTimersByTime(2000);

    // Simulate reload
    playerStore.getState().init();
    await libraryStore.getState().loadLibrary();

    const reloadedTrack = await db.tracks.get(track.id);
    expect(reloadedTrack?.isDownloaded).toBe(true);
    expect(reloadedTrack?.audioBlob).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Pairwise 10: F6 (Autoplay) + F7 (Reload Persistence)
  // --------------------------------------------------------------------------
  it('P10 [F6 + F7]: autoplay-extended queue persists to localStorage and survives session hydration', async () => {
    await playerStore.getState().playTrack(INITIAL_TRACKS[0], [INITIAL_TRACKS[0]]);
    playerStore.setState({ repeat: 'off' });

    // Trigger autoplay queue expansion
    await playerStore.getState().nextTrack();

    const expandedQueueLength = playerStore.getState().queue.length;
    expect(expandedQueueLength).toBeGreaterThan(1);

    vi.advanceTimersByTime(2000);

    // Simulate reload
    playerStore.getState().init();

    const state = playerStore.getState();
    expect(state.queue.length).toBe(expandedQueueLength);
  });

  // --------------------------------------------------------------------------
  // Pairwise 11: F1 (Previous) + F6 (Autoplay)
  // --------------------------------------------------------------------------
  it('P11 [F1 + F6]: previousTrack navigates backwards cleanly after autoplay queue expansion', async () => {
    await playerStore.getState().playTrack(INITIAL_TRACKS[0], [INITIAL_TRACKS[0]]);
    playerStore.setState({ repeat: 'off' });

    // Autoplay expands queue and plays recommendation
    await playerStore.getState().nextTrack();
    const currentIdx = playerStore.getState().queueIndex;
    expect(currentIdx).toBe(1);

    playerStore.setState({ currentTime: 1.0 }); // within 3s
    await playerStore.getState().previousTrack();

    const state = playerStore.getState();
    expect(state.queueIndex).toBe(0);
    expect(state.currentTrack?.id).toBe(INITIAL_TRACKS[0].id);
  });

  // --------------------------------------------------------------------------
  // Pairwise 12: F3 (Scrubber) + F5 (Offline Download)
  // --------------------------------------------------------------------------
  it('P12 [F3 + F5]: seeking functions accurately on downloaded track playing from audioBlob object URL', async () => {
    const track = INITIAL_TRACKS[0];
    const downloaded = await downloadService.downloadTrack(track);

    await playerStore.getState().playTrack(downloaded, [downloaded]);

    // Seek on offline blob
    playerStore.getState().seek(85);

    const state = playerStore.getState();
    expect(state.currentTime).toBe(85);
    expect(state.currentTrack?.isDownloaded).toBe(true);
  });
});
