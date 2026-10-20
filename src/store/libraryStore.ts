import { create } from 'zustand';
import confetti from 'canvas-confetti';
import { Track, Playlist } from '../types';
import { db, initializeDatabase } from '../services/db/database';
import { downloadService } from '../services/downloader/downloadService';
import { parseLocalAudioFile, revitalizeTrackBlobUrls } from '../services/metadata/tagParser';
import { usePlayerStore } from './playerStore';

interface LibraryState {
  tracks: Track[];
  playlists: Playlist[];
  searchQuery: string;
  downloadProgress: Record<string, number>;
  isLoading: boolean;

  loadLibrary: () => Promise<void>;
  toggleLike: (trackId: string, trackFallback?: Track) => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  updatePlaylist: (playlistId: string, updates: Partial<Playlist>) => Promise<void>;
  downloadTrack: (track: Track) => Promise<void>;
  removeDownload: (trackId: string) => Promise<void>;
  downloadPlaylist: (playlistId: string) => Promise<void>;
  importLocalFiles: (files: File[]) => Promise<number>;
  exportTrack: (track: Track) => Promise<void>;
  setSearchQuery: (query: string) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  playlists: [],
  searchQuery: '',
  downloadProgress: {},
  isLoading: true,

  loadLibrary: async () => {
    set({ isLoading: true });
    await initializeDatabase();
    const rawTracks = await db.tracks.toArray();
    const playlists = await db.playlists.toArray();
    const tracks = rawTracks.map(revitalizeTrackBlobUrls);

    // Sync active player session with freshly hydrated tracks (blobs & URLs)
    const cur = usePlayerStore.getState().currentTrack;
    if (cur) {
      const freshCur = tracks.find((t) => t.id === cur.id);
      if (freshCur) {
        usePlayerStore.setState({ currentTrack: freshCur });
      }
    }
    const currentQueue = usePlayerStore.getState().queue;
    if (currentQueue && currentQueue.length > 0) {
      usePlayerStore.setState({
        queue: currentQueue.map((q) => tracks.find((t) => t.id === q.id) || q),
      });
    }

    set({ tracks, playlists, isLoading: false });
  },

  toggleLike: async (trackId: string, trackFallback?: Track) => {
    const { tracks } = get();
    let track = tracks.find((t) => t.id === trackId);
    const isNewTrack = !track;

    if (!track) {
      if (trackFallback) {
        track = { ...trackFallback };
      } else {
        const cur = usePlayerStore.getState().currentTrack;
        if (cur && cur.id === trackId) {
          track = { ...cur };
        }
      }
    }
    if (!track) return;

    const newLiked = isNewTrack ? true : !track.isLiked;
    const updated: Track = { ...track, isLiked: newLiked };

    await db.tracks.put(updated);

    if (newLiked) {
      try {
        confetti({
          particleCount: 30,
          spread: 45,
          origin: { y: 0.9, x: 0.1 },
          colors: ['#1DB954', '#ffffff', '#1ed760'],
        });
      } catch {
        // Safe in headless test environments or when canvas is unavailable
      }
    }

    const cur = usePlayerStore.getState().currentTrack;
    if (cur && cur.id === trackId) {
      usePlayerStore.setState({ currentTrack: { ...cur, isLiked: newLiked } });
    }
    usePlayerStore.setState((s) => ({
      queue: s.queue.map((q) => (q.id === trackId ? { ...q, isLiked: newLiked } : q)),
    }));

    set({
      tracks: isNewTrack
        ? [updated, ...tracks]
        : tracks.map((t) => (t.id === trackId ? updated : t)),
    });
  },

  createPlaylist: async (name: string, description = '') => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name: name.trim() || 'My Playlist',
      description,
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
      trackIds: [],
      isCustom: true,
      createdAt: Date.now(),
    };

    await db.playlists.add(newPlaylist);
    set((state) => ({ playlists: [...state.playlists, newPlaylist] }));
    return newPlaylist;
  },

  addTrackToPlaylist: async (playlistId: string, trackId: string) => {
    const playlist = await db.playlists.get(playlistId);
    if (!playlist) return;

    if (!playlist.trackIds.includes(trackId)) {
      const updatedTrackIds = [...playlist.trackIds, trackId];
      await db.playlists.update(playlistId, { trackIds: updatedTrackIds });

      set((state) => ({
        playlists: state.playlists.map((p) =>
          p.id === playlistId ? { ...p, trackIds: updatedTrackIds } : p
        ),
      }));
    }
  },

  removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
    const playlist = await db.playlists.get(playlistId);
    if (!playlist) return;

    const updatedTrackIds = playlist.trackIds.filter((id) => id !== trackId);
    await db.playlists.update(playlistId, { trackIds: updatedTrackIds });

    set((state) => ({
      playlists: state.playlists.map((p) =>
        p.id === playlistId ? { ...p, trackIds: updatedTrackIds } : p
      ),
    }));
  },

  deletePlaylist: async (playlistId: string) => {
    await db.playlists.delete(playlistId);
    set((state) => ({
      playlists: state.playlists.filter((p) => p.id !== playlistId),
    }));
  },

  updatePlaylist: async (playlistId: string, updates: Partial<Playlist>) => {
    const pl = await db.playlists.get(playlistId);
    if (!pl) return;
    const updated = { ...pl, ...updates };
    await db.playlists.put(updated);
    set((state) => ({
      playlists: state.playlists.map((p) => (p.id === playlistId ? updated : p)),
    }));
  },

  downloadTrack: async (track: Track) => {
    set((state) => ({
      downloadProgress: { ...state.downloadProgress, [track.id]: 1 },
    }));

    try {
      const updatedTrack = await downloadService.downloadTrack(track, (percent) => {
        set((state) => ({
          downloadProgress: { ...state.downloadProgress, [track.id]: percent },
        }));
      });

      if (updatedTrack.isDownloaded) {
        const cur = usePlayerStore.getState().currentTrack;
        if (cur && cur.id === track.id) {
          usePlayerStore.setState({
            currentTrack: {
              ...cur,
              isDownloaded: true,
              audioBlob: updatedTrack.audioBlob,
              artworkBlob: updatedTrack.artworkBlob,
              audioUrl: updatedTrack.audioUrl,
              artworkUrl: updatedTrack.artworkUrl,
            },
          });
        }
        usePlayerStore.setState((s) => ({
          queue: s.queue.map((q) =>
            q.id === track.id
              ? {
                  ...q,
                  isDownloaded: true,
                  audioBlob: updatedTrack.audioBlob,
                  artworkBlob: updatedTrack.artworkBlob,
                  audioUrl: updatedTrack.audioUrl,
                  artworkUrl: updatedTrack.artworkUrl,
                }
              : q
          ),
        }));

        const exists = get().tracks.some((t) => t.id === track.id);
        set((state) => {
          const newProgress = { ...state.downloadProgress };
          delete newProgress[track.id];
          return {
            downloadProgress: newProgress,
            tracks: exists
              ? state.tracks.map((t) => (t.id === track.id ? updatedTrack : t))
              : [updatedTrack, ...state.tracks],
          };
        });

        // Celebration
        try {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#1DB954', '#1ed760'],
          });
        } catch {
          // Safe
        }
      } else {
        // Blob fetch failed, do not mark isDownloaded in player store
        set((state) => {
          const newProgress = { ...state.downloadProgress };
          delete newProgress[track.id];
          return {
            downloadProgress: newProgress,
            tracks: state.tracks.map((t) => (t.id === track.id ? updatedTrack : t)),
          };
        });
      }
    } catch (err) {
      console.error('Download error:', err);
      set((state) => {
        const newProgress = { ...state.downloadProgress };
        delete newProgress[track.id];
        return { downloadProgress: newProgress };
      });
    }
  },

  removeDownload: async (trackId: string) => {
    await downloadService.removeDownloadedTrack(trackId);
    const cur = usePlayerStore.getState().currentTrack;
    if (cur && cur.id === trackId) {
      usePlayerStore.setState({
        currentTrack: { ...cur, isDownloaded: false, audioBlob: undefined },
      });
    }
    usePlayerStore.setState((s) => ({
      queue: s.queue.map((q) =>
        q.id === trackId ? { ...q, isDownloaded: false, audioBlob: undefined } : q
      ),
    }));
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, isDownloaded: false, audioBlob: undefined } : t
      ),
    }));
  },

  downloadPlaylist: async (playlistId: string) => {
    const playlist = await db.playlists.get(playlistId);
    if (!playlist) return;

    for (const trackId of playlist.trackIds) {
      const track = get().tracks.find((t) => t.id === trackId);
      if (track && !track.isDownloaded) {
        await get().downloadTrack(track);
      }
    }

    await db.playlists.update(playlistId, { isDownloaded: true });
    set((state) => ({
      playlists: state.playlists.map((p) =>
        p.id === playlistId ? { ...p, isDownloaded: true } : p
      ),
    }));
  },

  importLocalFiles: async (files: File[]) => {
    let importedCount = 0;
    const newTracks: Track[] = [];

    for (const file of files) {
      if (
        file.type.startsWith('audio/') ||
        /\.(mp3|flac|wav|m4a|ogg|aac|wma)$/i.test(file.name)
      ) {
        try {
          const track = await parseLocalAudioFile(file);
          await db.tracks.add(track);
          newTracks.push(track);
          importedCount++;
        } catch (e) {
          console.warn('Failed parsing local file:', file.name, e);
        }
      }
    }

    if (newTracks.length > 0) {
      set((state) => ({
        tracks: [...newTracks, ...state.tracks],
      }));
    }

    return importedCount;
  },

  exportTrack: async (track: Track) => {
    await downloadService.exportTrackToDisk(track);
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },
}));
