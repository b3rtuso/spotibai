import { create } from 'zustand';
import { ActiveView } from '../types';

const UI_STORAGE_KEY = 'spotibai_ui_view_v1';
const FOLLOWED_ARTISTS_KEY = 'spotibai_followed_artists_v1';

function loadSavedUiView(): {
  activeView?: ActiveView;
  selectedPlaylistId?: string | null;
  selectedArtistName?: string | null;
  selectedArtistId?: string | null;
  selectedAlbumId?: string | null;
} {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function persistUiView(
  activeView: ActiveView,
  selectedPlaylistId: string | null,
  selectedArtistName?: string | null,
  selectedArtistId?: string | null,
  selectedAlbumId?: string | null
) {
  try {
    localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        activeView,
        selectedPlaylistId,
        selectedArtistName,
        selectedArtistId,
        selectedAlbumId,
      })
    );
  } catch {
    // ignore
  }
}

function loadFollowedArtists(): string[] {
  try {
    const raw = localStorage.getItem(FOLLOWED_ARTISTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistFollowedArtists(artists: string[]) {
  try {
    localStorage.setItem(FOLLOWED_ARTISTS_KEY, JSON.stringify(artists));
  } catch {
    // ignore
  }
}

interface UiState {
  activeView: ActiveView;
  selectedPlaylistId: string | null;
  selectedArtistName: string | null;
  selectedArtistId: string | null;
  selectedAlbumId: string | null;
  followedArtists: string[];
  viewHistory: ActiveView[];
  viewHistoryIndex: number;
  ambientColor: string;
  isLyricsOpen: boolean;
  isEqualizerOpen: boolean;
  isQueueOpen: boolean;
  isMiniPlayer: boolean;
  isFullscreen: boolean;
  isImportModalOpen: boolean;
  isSpotifyImportModalOpen: boolean;
  isOfflineMode: boolean;
  isShortcutsOpen: boolean;
  isEditPlaylistOpen: boolean;
  editingPlaylistId: string | null;
  isFullscreenNowPlaying: boolean;

  setActiveView: (view: ActiveView) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setSelectedArtist: (artistName: string, artistId?: string) => void;
  setSelectedAlbum: (albumId: string) => void;
  toggleFollowArtist: (artistName: string) => void;
  goBack: () => void;
  goForward: () => void;
  setAmbientColor: (color: string) => void;
  toggleLyrics: () => void;
  toggleEqualizer: () => void;
  toggleQueue: () => void;
  toggleMiniPlayer: () => void;
  toggleFullscreen: () => void;
  toggleFullscreenNowPlaying: () => void;
  toggleShortcuts: () => void;
  openEditPlaylist: (id: string) => void;
  closeEditPlaylist: () => void;
  setImportModalOpen: (open: boolean) => void;
  setSpotifyImportModalOpen: (open: boolean) => void;
  toggleOfflineMode: () => void;
}

const savedUi = loadSavedUiView();
const initialView = savedUi.activeView || 'home';

export const useUiStore = create<UiState>((set, get) => ({
  activeView: initialView,
  selectedPlaylistId: savedUi.selectedPlaylistId || null,
  selectedArtistName: savedUi.selectedArtistName || null,
  selectedArtistId: savedUi.selectedArtistId || null,
  selectedAlbumId: savedUi.selectedAlbumId || null,
  followedArtists: loadFollowedArtists(),
  viewHistory: [initialView],
  viewHistoryIndex: 0,
  ambientColor: 'rgb(30, 40, 50)',
  isLyricsOpen: false,
  isEqualizerOpen: false,
  isQueueOpen: false,
  isMiniPlayer: false,
  isFullscreen: false,
  isFullscreenNowPlaying: false,
  isShortcutsOpen: false,
  isEditPlaylistOpen: false,
  editingPlaylistId: null,
  isImportModalOpen: false,
  isSpotifyImportModalOpen: false,
  isOfflineMode: false,

  setActiveView: (view) => {
    const { viewHistory, viewHistoryIndex, selectedPlaylistId, selectedArtistName, selectedArtistId, selectedAlbumId } = get();
    persistUiView(view, selectedPlaylistId, selectedArtistName, selectedArtistId, selectedAlbumId);
    
    // Append to navigation history stack
    const newHistory = [...viewHistory.slice(0, viewHistoryIndex + 1), view];
    set({
      activeView: view,
      viewHistory: newHistory,
      viewHistoryIndex: newHistory.length - 1,
    });
  },

  setSelectedPlaylistId: (id) => {
    const { viewHistory, viewHistoryIndex, selectedArtistName, selectedArtistId, selectedAlbumId } = get();
    persistUiView('playlist', id, selectedArtistName, selectedArtistId, selectedAlbumId);
    const newHistory = [...viewHistory.slice(0, viewHistoryIndex + 1), 'playlist' as ActiveView];
    set({
      selectedPlaylistId: id,
      activeView: 'playlist',
      viewHistory: newHistory,
      viewHistoryIndex: newHistory.length - 1,
    });
  },

  setSelectedArtist: (artistName, artistId) => {
    const { viewHistory, viewHistoryIndex, selectedPlaylistId, selectedAlbumId } = get();
    persistUiView('artist', selectedPlaylistId, artistName, artistId || null, selectedAlbumId);
    const newHistory = [...viewHistory.slice(0, viewHistoryIndex + 1), 'artist' as ActiveView];
    set({
      selectedArtistName: artistName,
      selectedArtistId: artistId || null,
      activeView: 'artist',
      viewHistory: newHistory,
      viewHistoryIndex: newHistory.length - 1,
    });
  },

  setSelectedAlbum: (albumId) => {
    const { viewHistory, viewHistoryIndex, selectedPlaylistId, selectedArtistName, selectedArtistId } = get();
    persistUiView('album', selectedPlaylistId, selectedArtistName, selectedArtistId, albumId);
    const newHistory = [...viewHistory.slice(0, viewHistoryIndex + 1), 'album' as ActiveView];
    set({
      selectedAlbumId: albumId,
      activeView: 'album',
      viewHistory: newHistory,
      viewHistoryIndex: newHistory.length - 1,
    });
  },

  toggleFollowArtist: (artistName) => {
    const { followedArtists } = get();
    const isFollowed = followedArtists.includes(artistName);
    const updated = isFollowed
      ? followedArtists.filter((a) => a !== artistName)
      : [...followedArtists, artistName];
    persistFollowedArtists(updated);
    set({ followedArtists: updated });
  },

  goBack: () => {
    const { viewHistory, viewHistoryIndex } = get();
    if (viewHistoryIndex > 0) {
      const prevIndex = viewHistoryIndex - 1;
      const prevView = viewHistory[prevIndex];
      set({
        activeView: prevView,
        viewHistoryIndex: prevIndex,
      });
    }
  },

  goForward: () => {
    const { viewHistory, viewHistoryIndex } = get();
    if (viewHistoryIndex < viewHistory.length - 1) {
      const nextIndex = viewHistoryIndex + 1;
      const nextView = viewHistory[nextIndex];
      set({
        activeView: nextView,
        viewHistoryIndex: nextIndex,
      });
    }
  },

  setAmbientColor: (color) => set({ ambientColor: color }),
  toggleLyrics: () => set((state) => ({ isLyricsOpen: !state.isLyricsOpen })),
  toggleEqualizer: () => set((state) => ({ isEqualizerOpen: !state.isEqualizerOpen })),
  toggleQueue: () => set((state) => ({ isQueueOpen: !state.isQueueOpen })),
  toggleMiniPlayer: () => set((state) => ({ isMiniPlayer: !state.isMiniPlayer })),
  toggleFullscreen: () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      set({ isFullscreen: true });
    } else {
      document.exitFullscreen().catch(() => {});
      set({ isFullscreen: false });
    }
  },
  toggleFullscreenNowPlaying: () => set((state) => ({ isFullscreenNowPlaying: !state.isFullscreenNowPlaying })),
  toggleShortcuts: () => set((state) => ({ isShortcutsOpen: !state.isShortcutsOpen })),
  openEditPlaylist: (id) => set({ isEditPlaylistOpen: true, editingPlaylistId: id }),
  closeEditPlaylist: () => set({ isEditPlaylistOpen: false, editingPlaylistId: null }),
  setImportModalOpen: (open) => set({ isImportModalOpen: open }),
  setSpotifyImportModalOpen: (open) => set({ isSpotifyImportModalOpen: open }),
  toggleOfflineMode: () => set((state) => ({ isOfflineMode: !state.isOfflineMode })),
}));
