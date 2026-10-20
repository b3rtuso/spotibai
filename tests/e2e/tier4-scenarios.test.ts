import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';

installGlobalBrowserMocks();

describe('Tier 4: Real-World Application Scenarios', () => {
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
  // Scenario 1: Continuous Album Binge with Queue Exhaustion & Autoplay
  // Exercising: F1 (Previous), F2 (Play/Pause), F3 (Scrubber Seeking), F6 (Autoplay)
  // --------------------------------------------------------------------------
  it('Scenario 1: Continuous Album Binge with Queue Exhaustion & Autoplay', async () => {
    // 1. User loads an album playlist with 3 tracks
    const albumQueue = INITIAL_TRACKS.slice(0, 3);
    await playerStore.getState().playTrack(albumQueue[0], albumQueue);
    expect(playerStore.getState().currentTrack?.id).toBe(albumQueue[0].id);
    expect(playerStore.getState().isPlaying).toBe(true);

    // 2. Advances to track 2, seeks through track 2
    await playerStore.getState().nextTrack();
    expect(playerStore.getState().queueIndex).toBe(1);
    expect(playerStore.getState().currentTrack?.id).toBe(albumQueue[1].id);

    playerStore.getState().seek(45);
    expect(playerStore.getState().currentTime).toBe(45);

    // 3. User hits Previous past 3 seconds (>3s) -> restarts track 2 to 0:00
    await playerStore.getState().previousTrack();
    expect(playerStore.getState().currentTime).toBe(0);
    expect(playerStore.getState().queueIndex).toBe(1);

    // Consecutive previous click at 0:00 (<=3s) -> returns to track 1
    await playerStore.getState().previousTrack();
    expect(playerStore.getState().queueIndex).toBe(0);
    expect(playerStore.getState().currentTrack?.id).toBe(albumQueue[0].id);

    // 4. Advances through queue to track 3 (last track)
    await playerStore.getState().nextTrack(); // back to track 2
    await playerStore.getState().nextTrack(); // to track 3 (last track)
    expect(playerStore.getState().queueIndex).toBe(2);

    // 5. Track 3 finishes -> triggers queue exhaustion nextTrack() with repeat: 'off'
    playerStore.setState({ repeat: 'off' });
    await playerStore.getState().nextTrack();

    // 6. Autoplay engine activates: automatically scores catalog and appends similar tracks
    const finalState = playerStore.getState();
    expect(finalState.queue.length).toBeGreaterThan(3);
    expect(finalState.isPlaying).toBe(true);
    expect(finalState.queueIndex).toBe(3); // First recommended song is now playing
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Offline Flight Mode (Downloaded Track Playback & Like Sync)
  // Exercising: F2 (Play/Pause), F4 (Like Heart Sync), F5 (Offline Download)
  // --------------------------------------------------------------------------
  it('Scenario 2: Offline Flight Mode (Downloaded Track Playback & Like Sync)', async () => {
    // 1. User downloads tracks online before flight
    const trackA = INITIAL_TRACKS[0];
    const trackB = INITIAL_TRACKS[1]; // unliked initially
    const downloadedA = await downloadService.downloadTrack(trackA);
    const downloadedB = await downloadService.downloadTrack(trackB);

    expect(downloadedB.isDownloaded).toBe(true);
    expect(downloadedB.audioBlob).toBeDefined();

    // 2. Simulates airplane mode: network completely unavailable
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = () => {
        throw new Error('TypeError: Failed to fetch (Flight Mode - No Internet)');
      };

      // 3. Plays downloaded track completely offline from audioBlob
      await playerStore.getState().playTrack(downloadedB, [downloadedB, downloadedA]);
      expect(playerStore.getState().isPlaying).toBe(true);
      expect(playerStore.getState().currentTrack?.isDownloaded).toBe(true);

      // 4. User pauses and resumes playback offline
      await playerStore.getState().togglePlay();
      expect(playerStore.getState().isPlaying).toBe(false);
      await playerStore.getState().togglePlay();
      expect(playerStore.getState().isPlaying).toBe(true);

      // 5. User likes the track offline
      await libraryStore.getState().toggleLike(downloadedB.id);

      // 6. Like status is reliably stored in local IndexedDB without network
      const dbTrack = await db.tracks.get(downloadedB.id);
      expect(dbTrack?.isLiked).toBe(true);
      expect(playerStore.getState().currentTrack?.isLiked).toBe(true);
    } finally {
      // Restore network mock
      globalThis.fetch = originalFetch;
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Sudden Reload Mid-Playback & Session Resume
  // Exercising: F2 (Play/Pause), F3 (Scrubber / Volume), F7 (Reload Persistence)
  // --------------------------------------------------------------------------
  it('Scenario 3: Sudden Reload Mid-Playback & Session Resume', async () => {
    // 1. User is playing track 2 in a 4-track queue at currentTime: 85s, volume: 0.65
    await playerStore.getState().playTrack(INITIAL_TRACKS[1], INITIAL_TRACKS);
    playerStore.getState().seek(85);
    playerStore.getState().setVolume(0.65);
    playerStore.setState({ shuffle: true, repeat: 'all' });

    // Ensure session write commits to localStorage
    vi.advanceTimersByTime(2000);

    const savedRaw = localStorage.getItem('spotibai_playback_session_v1');
    expect(savedRaw).not.toBeNull();

    // 2. Sudden browser reload (F5) simulated:
    // Reset Zustand store state to uninitialized memory
    playerStore.setState({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      volume: 0.8,
      queue: [],
      queueIndex: 0,
      shuffle: false,
      repeat: 'off',
    });

    // 3. App loads and hydrates session state
    playerStore.getState().init();

    const hydrated = playerStore.getState();
    expect(hydrated.currentTrack?.id).toBe(INITIAL_TRACKS[1].id);
    expect(hydrated.currentTime).toBe(85);
    expect(hydrated.volume).toBeCloseTo(0.65);
    expect(hydrated.shuffle).toBe(true);
    expect(hydrated.repeat).toBe('all');
    expect(hydrated.queue.length).toBe(INITIAL_TRACKS.length);
    // Respects browser autoplay policy: does not play automatically upon reload
    expect(hydrated.isPlaying).toBe(false);

    // 4. User clicks Play -> resumes smoothly from 85s
    await playerStore.getState().togglePlay();
    expect(playerStore.getState().isPlaying).toBe(true);
    expect(playerStore.getState().currentTime).toBe(85);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Rapid Control DJ Stress (Rapid Shuffle, Repeat, Seek, Volume)
  // Exercising: F1 (Previous), F2 (Play/Pause), F3 (Scrubber/Volume), F7 (Persistence)
  // --------------------------------------------------------------------------
  it('Scenario 4: Rapid Control DJ Stress (Rapid Shuffle, Repeat, Seek, Volume)', async () => {
    await playerStore.getState().playTrack(INITIAL_TRACKS[0], INITIAL_TRACKS);

    // 1. Rapid toggle shuffle 10 times
    for (let i = 0; i < 10; i++) {
      playerStore.getState().toggleShuffle();
    }
    // 10 toggles returns to original shuffle: false
    expect(playerStore.getState().shuffle).toBe(false);

    // 2. Rapid repeat cycle ('off' -> 'all' -> 'one' -> 'off') 6 times
    for (let i = 0; i < 6; i++) {
      playerStore.getState().toggleRepeat();
    }
    // 6 cycles % 3 = 0 -> returns to 'off'
    expect(playerStore.getState().repeat).toBe('off');

    // 3. Rapid erratic seeks
    const seekPoints = [10, 150, 0, 75, 120, 5];
    for (const pt of seekPoints) {
      playerStore.getState().seek(pt);
    }
    expect(playerStore.getState().currentTime).toBe(5);

    // 4. Rapid volume adjustments & mute toggles
    playerStore.getState().setVolume(0.9);
    playerStore.getState().toggleMute();
    expect(playerStore.getState().isMuted).toBe(true);
    playerStore.getState().toggleMute();
    expect(playerStore.getState().isMuted).toBe(false);
    expect(playerStore.getState().volume).toBeCloseTo(0.9);

    // 5. System remains completely stable without throwing or corrupting
    vi.advanceTimersByTime(2000);
    const session = JSON.parse(localStorage.getItem('spotibai_playback_session_v1')!);
    expect(session.currentTime).toBe(5);
    expect(session.volume).toBeCloseTo(0.9);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Full Library Discovery & Like & Download Pipeline
  // Exercising: F4 (Like Sync), F5 (Download), F6 (Autoplay), F7 (Persistence)
  // --------------------------------------------------------------------------
  it('Scenario 5: Full Library Discovery & Like & Download Pipeline', async () => {
    // 1. User explores catalog and plays unliked track
    const targetTrack = INITIAL_TRACKS[1]; // unliked initially
    await playerStore.getState().playTrack(targetTrack, INITIAL_TRACKS);

    // 2. Likes the track
    await libraryStore.getState().toggleLike(targetTrack.id);
    expect(playerStore.getState().currentTrack?.isLiked).toBe(true);

    // 3. Downloads track for offline use
    const updatedTrackFromDb = (await db.tracks.get(targetTrack.id)) || targetTrack;
    await downloadService.downloadTrack(updatedTrackFromDb);
    const dbTrack = await db.tracks.get(targetTrack.id);
    expect(dbTrack?.isDownloaded).toBe(true);
    expect(dbTrack?.audioBlob).toBeDefined();

    // 4. Creates a custom playlist and adds the liked track
    const newPlaylist = await libraryStore.getState().createPlaylist('Midnight Favorites', 'My top beats');
    await libraryStore.getState().addTrackToPlaylist(newPlaylist.id, targetTrack.id);

    const savedPl = await db.playlists.get(newPlaylist.id);
    expect(savedPl?.trackIds).toContain(targetTrack.id);

    // 5. Simulates queue completion triggering Autoplay
    playerStore.setState({ queue: [targetTrack], queueIndex: 0, repeat: 'off' });
    await playerStore.getState().nextTrack();

    // Recommendation engine generated new songs
    expect(playerStore.getState().queue.length).toBeGreaterThan(1);

    // 6. Reload simulation: everything survives
    vi.advanceTimersByTime(2000);
    playerStore.getState().init();
    await libraryStore.getState().loadLibrary();

    const finalPl = libraryStore.getState().playlists.find((p) => p.id === newPlaylist.id);
    expect(finalPl).toBeDefined();
    expect(finalPl?.trackIds).toContain(targetTrack.id);

    const finalTrack = await db.tracks.get(targetTrack.id);
    expect(finalTrack?.isLiked).toBe(true);
    expect(finalTrack?.isDownloaded).toBe(true);
  });
});
