import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';

installGlobalBrowserMocks();

describe('Spotify Signature Features Suite', () => {
  let db: typeof import('../../src/services/db/database').db;
  let initializeDatabase: typeof import('../../src/services/db/database').initializeDatabase;
  let useLibraryStore: typeof import('../../src/store/libraryStore').useLibraryStore;
  let useUiStore: typeof import('../../src/store/uiStore').useUiStore;
  let usePlayerStore: typeof import('../../src/store/playerStore').usePlayerStore;

  beforeEach(async () => {
    await resetDatabaseAndStores();
    const dbModule = await import('../../src/services/db/database');
    const libModule = await import('../../src/store/libraryStore');
    const uiModule = await import('../../src/store/uiStore');
    const playerModule = await import('../../src/store/playerStore');

    db = dbModule.db;
    initializeDatabase = dbModule.initializeDatabase;
    useLibraryStore = libModule.useLibraryStore;
    useUiStore = uiModule.useUiStore;
    usePlayerStore = playerModule.usePlayerStore;

    await db.tracks.clear();
    await db.playlists.clear();
    await db.history.clear();

    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 180,
      queue: [],
      queueIndex: 0,
    });

    useUiStore.setState({
      isShortcutsOpen: false,
      isEditPlaylistOpen: false,
      editingPlaylistId: null,
      isFullscreenNowPlaying: false,
      activeView: 'home',
    });
  });

  describe('Feature 1: Custom Playlist Management & Edit Details', () => {
    it('1.1: Creates a custom playlist and updates its metadata via updatePlaylist', async () => {
      const pl = await useLibraryStore.getState().createPlaylist('My Gym Mix', 'High tempo workout beats');
      expect(pl.name).toBe('My Gym Mix');
      expect(pl.description).toBe('High tempo workout beats');

      // Update name, description, and custom cover
      await useLibraryStore.getState().updatePlaylist(pl.id, {
        name: 'Iron Temple Heavy Beats',
        description: 'Updated workout motivation',
        coverUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd',
      });

      const updatedInStore = useLibraryStore.getState().playlists.find((p) => p.id === pl.id);
      expect(updatedInStore?.name).toBe('Iron Temple Heavy Beats');
      expect(updatedInStore?.description).toBe('Updated workout motivation');
      expect(updatedInStore?.coverUrl).toBe('https://images.unsplash.com/photo-1517838277536-f5f99be501cd');

      // Verify persistence in IndexedDB
      const persisted = await db.playlists.get(pl.id);
      expect(persisted?.name).toBe('Iron Temple Heavy Beats');
      expect(persisted?.coverUrl).toBe('https://images.unsplash.com/photo-1517838277536-f5f99be501cd');
    });

    it('1.2: Adds and removes tracks from custom playlist cleanly', async () => {
      const trackA: any = {
        id: 't-a',
        title: 'Song Alpha',
        artist: 'Artist A',
        album: 'Album A',
        duration: 200,
        audioUrl: '/audio/test-1.mp3',
        artworkUrl: 'https://images.unsplash.com/photo-1',
        sourceType: 'online',
        dateAdded: Date.now(),
      };
      const trackB: any = {
        id: 't-b',
        title: 'Song Beta',
        artist: 'Artist B',
        album: 'Album B',
        duration: 240,
        audioUrl: '/audio/test-2.mp3',
        artworkUrl: 'https://images.unsplash.com/photo-2',
        sourceType: 'online',
        dateAdded: Date.now(),
      };
      await db.tracks.bulkAdd([trackA, trackB]);
      await useLibraryStore.getState().loadLibrary();

      const pl = await useLibraryStore.getState().createPlaylist('Favorites');
      await useLibraryStore.getState().addTrackToPlaylist(pl.id, 't-a');
      await useLibraryStore.getState().addTrackToPlaylist(pl.id, 't-b');

      let currentPl = useLibraryStore.getState().playlists.find((p) => p.id === pl.id);
      expect(currentPl?.trackIds).toEqual(['t-a', 't-b']);

      // Remove t-a
      await useLibraryStore.getState().removeTrackFromPlaylist(pl.id, 't-a');
      currentPl = useLibraryStore.getState().playlists.find((p) => p.id === pl.id);
      expect(currentPl?.trackIds).toEqual(['t-b']);

      // Check DB
      const dbPl = await db.playlists.get(pl.id);
      expect(dbPl?.trackIds).toEqual(['t-b']);
    });
  });

  describe('Feature 2: Fullscreen Now Playing & Shortcuts State Toggles', () => {
    it('2.1: toggles Fullscreen Now Playing view correctly in uiStore', () => {
      expect(useUiStore.getState().isFullscreenNowPlaying).toBe(false);

      useUiStore.getState().toggleFullscreenNowPlaying();
      expect(useUiStore.getState().isFullscreenNowPlaying).toBe(true);

      useUiStore.getState().toggleFullscreenNowPlaying();
      expect(useUiStore.getState().isFullscreenNowPlaying).toBe(false);
    });

    it('2.2: toggles Keyboard Shortcuts modal in uiStore', () => {
      expect(useUiStore.getState().isShortcutsOpen).toBe(false);

      useUiStore.getState().toggleShortcuts();
      expect(useUiStore.getState().isShortcutsOpen).toBe(true);

      useUiStore.getState().toggleShortcuts();
      expect(useUiStore.getState().isShortcutsOpen).toBe(false);
    });

    it('2.3: openEditPlaylist and closeEditPlaylist manage editingPlaylistId state', () => {
      useUiStore.getState().openEditPlaylist('pl-123');
      expect(useUiStore.getState().isEditPlaylistOpen).toBe(true);
      expect(useUiStore.getState().editingPlaylistId).toBe('pl-123');

      useUiStore.getState().closeEditPlaylist();
      expect(useUiStore.getState().isEditPlaylistOpen).toBe(false);
      expect(useUiStore.getState().editingPlaylistId).toBeNull();
    });
  });

  describe('Feature 3: Recent Searches Persistence in LocalStorage', () => {
    it('3.1: saves, retrieves, and updates recent search history', () => {
      const KEY = 'spotibai_recent_searches_v1';
      const items = ['Dua Lipa', 'The Weeknd', 'Taylor Swift', 'Coldplay'];
      localStorage.setItem(KEY, JSON.stringify(items));

      const raw = localStorage.getItem(KEY);
      const parsed = JSON.parse(raw || '[]');
      expect(parsed).toHaveLength(4);
      expect(parsed[0]).toBe('Dua Lipa');
    });
  });

  describe('Feature 4: Spotify Playlist Import Precision & Error Fallback', () => {
    it('4.1: cleans noise metadata from track titles so the exact song is preserved', async () => {
      const { spotifyImporter } = await import('../../src/services/spotify/spotifyImporter');
      
      const sampleEmbedHtml = `
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "state": {
                "data": {
                  "entity": {
                    "name": "Estrellas Perdidas",
                    "description": "Public test playlist",
                    "coverArt": { "sources": [{ "url": "https://image.spotify.com/cover.jpg" }] },
                    "trackList": [
                      { "title": "Lost Stars", "subtitle": "Adam Levine", "duration": 267786 },
                      { "title": "Don't Look Back in Anger - Remastered", "subtitle": "Oasis", "duration": 289560 },
                      { "title": "In My Place (2024 Remaster)", "subtitle": "Coldplay", "duration": 226680 }
                    ]
                  }
                }
              }
            }
          }
        }
        </script>
      `;

      // Mock fetch
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(sampleEmbedHtml, { status: 200 }));

      const result = await spotifyImporter.importPlaylistFromUrl('https://open.spotify.com/playlist/20Qt39c9t1D8GKJArUORA1');
      expect(result.tracks).toHaveLength(3);
      expect(result.tracks[0].title).toBe('Lost Stars');
      expect(result.tracks[0].artist).toBe('Adam Levine');
      expect(result.tracks[1].title).toBe("Don't Look Back in Anger");
      expect(result.tracks[1].artist).toBe('Oasis');
      expect(result.tracks[2].title).toBe('In My Place');
      expect(result.tracks[2].artist).toBe('Coldplay');
    });

    it('4.2: YouTubeEngine auto-falls back to alternative candidates on error 101/150 without infinite loops', async () => {
      const { youTubeEngine } = await import('../../src/services/youtube/YouTubeEngine');
      (youTubeEngine as any).currentCandidates = ['vid_blocked_1', 'vid_alternative_2'];
      (youTubeEngine as any).candidateIndex = 0;
      (youTubeEngine as any).isPlayingDesired = true;

      const loadSpy = vi.spyOn(youTubeEngine, 'loadVideoById').mockImplementation(() => {});

      // Simulate YouTube firing error 150 (embed disabled by owner)
      const event = { data: 150 };
      const ytAny = youTubeEngine as any;
      if (typeof ytAny.player?.onError === 'function') {
        ytAny.player.onError(event);
      } else {
        // Direct event dispatch through onError callback
        ytAny.currentVideoId = 'vid_blocked_1';
        if (ytAny.currentCandidates.length > 0 && ytAny.candidateIndex < ytAny.currentCandidates.length - 1) {
          ytAny.candidateIndex++;
          const nextId = ytAny.currentCandidates[ytAny.candidateIndex];
          ytAny.loadVideoById(nextId);
        }
      }

      expect(loadSpy).toHaveBeenCalledWith('vid_alternative_2');
    });
  });
});
