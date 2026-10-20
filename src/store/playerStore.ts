import { create } from 'zustand';
import { Track, RepeatMode, KaraokeStatus } from '../types';
import { audioEngine, EQ_PRESETS } from '../services/audio/AudioEngine';
import { youTubeEngine } from '../services/youtube/YouTubeEngine';
import { autoplayEngine } from '../services/recommendation/autoplayEngine';
import { karaokeService } from '../services/audio/karaokeService';
import { db } from '../services/db/database';
import { extractDominantColor } from '../utils/colorExtractor';
import { useUiStore } from './uiStore';

const SESSION_STORAGE_KEY = 'spotibai_playback_session_v1';

interface SavedSession {
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  volume: number;
  previousVolume?: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Track[];
  queueIndex: number;
}

function loadSavedSession(): Partial<SavedSession> | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let saveTimer: any = null;
let lastPrevClickTime = 0;
let lastPrevTrackId: string | null = null;

function persistSession(_ignoredState?: any, immediate = false) {
  const commit = () => {
    try {
      const state = typeof usePlayerStore !== 'undefined' && usePlayerStore.getState ? usePlayerStore.getState() : ({} as any);
      const data: SavedSession = {
        currentTrack: state.currentTrack || null,
        currentTime: state.currentTime || 0,
        duration: state.duration || 0,
        volume: state.volume ?? 0.8,
        previousVolume: state.previousVolume ?? (state.volume && state.volume > 0 ? state.volume : 0.8),
        isMuted: Boolean(state.isMuted),
        shuffle: Boolean(state.shuffle),
        repeat: state.repeat || 'off',
        queue: (state.queue || []).slice(0, 100),
        queueIndex: state.queueIndex || 0,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore storage errors
    }
  };

  if (immediate) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    commit();
    return;
  }

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    commit();
  }, 250);
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  previousVolume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Track[];
  queueIndex: number;
  history: Track[];
  crossfade: number;
  activePresetId: string;
  eqGains: number[];
  isVocalMuted: boolean;
  isKaraokeMode: boolean;
  vocalLevel: number;
  karaokeStatus: KaraokeStatus;
  karaokeStatusText: string;
  karaokeError: string | null;

  // Actions
  init: () => void;
  playTrack: (track: Track, newQueue?: Track[], targetIndex?: number) => Promise<void>;
  playFullTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  toggleVocalMute: () => Promise<void>;
  toggleKaraokeMode: () => Promise<void>;
  setVocalLevel: (level: number) => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setCrossfade: (seconds: number) => void;
  setEqGain: (bandIndex: number, gain: number) => void;
  applyPreset: (presetId: string) => void;
}

function isYouTubeTrack(track: Track | null): boolean {
  if (!track) return false;
  // If track has a local offline audioBlob or blob URL, play directly via HTML5 AudioEngine!
  if (track.audioBlob || (track.audioUrl && track.audioUrl.startsWith('blob:'))) return false;

  // If explicitly marked as YouTube or has YouTube ID/URL, play via YouTubeEngine
  if (
    track.sourceType === 'youtube' ||
    Boolean(track.youtubeId) ||
    Boolean(track.audioUrl && (track.audioUrl.includes('youtube.com') || track.audioUrl.includes('youtu.be')))
  ) {
    return true;
  }

  // If track has a local bundled audio file (/audio/...), play directly via HTML5 AudioEngine!
  if (track.audioUrl && track.audioUrl.startsWith('/audio/')) return false;
  // If track is a local file imported by the user without YouTube ID, play via HTML5 AudioEngine!
  if (track.sourceType === 'local') return false;
  // If track is an open direct audio stream (e.g. Audius), play via HTML5 AudioEngine!
  if (track.id.startsWith('audius-') && track.audioUrl && !track.audioUrl.includes('apple.com')) return false;

  // Catalog/online tracks from search (e.g. online-12345):
  return track.id.startsWith('online-') || track.sourceType === 'online';
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
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
  history: [],
  crossfade: 2,
  activePresetId: 'flat',
  eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  isVocalMuted: false,
  isKaraokeMode: false,
  vocalLevel: 100,
  karaokeStatus: 'idle',
  karaokeStatusText: '',
  karaokeError: null,

  init: () => {
    // 1. Rehydrate Saved Session across page reloads (F5)
    const saved = loadSavedSession();
    if (saved && saved.currentTrack) {
      // Purge any Apple Music preview URL or 30s clips from previous sessions
      if (saved.currentTrack.audioUrl && saved.currentTrack.audioUrl.includes('apple.com')) {
        saved.currentTrack.audioUrl = '';
      }
      if (saved.currentTrack.previewUrl && saved.currentTrack.previewUrl.includes('apple.com')) {
        saved.currentTrack.previewUrl = undefined;
      }
      // If duration was 30s from an old preview clip, restore the actual track duration
      let cleanDuration = saved.duration || saved.currentTrack.duration || 180;
      if (cleanDuration === 30 && saved.currentTrack.duration && saved.currentTrack.duration > 30) {
        cleanDuration = saved.currentTrack.duration;
      }
      if (saved.queue) {
        saved.queue.forEach((qTrack) => {
          if (qTrack.audioUrl && qTrack.audioUrl.includes('apple.com')) qTrack.audioUrl = '';
          if (qTrack.previewUrl && qTrack.previewUrl.includes('apple.com')) qTrack.previewUrl = undefined;
        });
      }

      const restoredQueue = saved.queue && saved.queue.length > 0 ? saved.queue : [saved.currentTrack];
      const restoredIndex = Math.min(saved.queueIndex || 0, restoredQueue.length - 1);
      const restoredVol = saved.volume ?? 0.8;
      const restoredPrevVol = saved.previousVolume ?? (restoredVol > 0 ? restoredVol : 0.8);
      const restoredMute = Boolean(saved.isMuted);

      set({
        currentTrack: saved.currentTrack,
        queue: restoredQueue,
        queueIndex: Math.max(0, restoredIndex),
        currentTime: saved.currentTime || 0,
        duration: cleanDuration,
        volume: restoredVol,
        previousVolume: restoredPrevVol,
        isMuted: restoredMute,
        repeat: saved.repeat || 'off',
        shuffle: Boolean(saved.shuffle),
        isPlaying: false,
      });

      audioEngine.setVolume(restoredMute ? 0 : restoredVol);
      youTubeEngine.setVolume(restoredMute ? 0 : restoredVol);

      extractDominantColor(saved.currentTrack.artworkUrl).then((color) => {
        useUiStore.getState().setAmbientColor(color);
      });
    }

    // 2. Sync HTML5 Audio Engine Callbacks
    audioEngine.onTimeUpdate = (currentTime, duration) => {
      const { currentTrack } = get();
      if (!isYouTubeTrack(currentTrack)) {
        set({ currentTime, duration: duration || currentTrack?.duration || 0 });
        persistSession({ ...get(), currentTime });
      }
    };

    audioEngine.onPlayStateChange = (isPlaying) => {
      const { currentTrack } = get();
      if (!isYouTubeTrack(currentTrack)) {
        set({ isPlaying });
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
      }
    };

    audioEngine.onTrackEnded = async () => {
      const { currentTrack, repeat } = get();
      if (!isYouTubeTrack(currentTrack)) {
        if (repeat === 'one' && currentTrack) {
          audioEngine.seek(0);
          await audioEngine.playTrack(currentTrack, 0);
        } else {
          await get().nextTrack();
        }
      }
    };

    // 3. Sync YouTube Player Engine Callbacks
    youTubeEngine.onTimeUpdate = (currentTime, duration) => {
      const { currentTrack } = get();
      if (isYouTubeTrack(currentTrack)) {
        set({ currentTime, duration: duration || currentTrack?.duration || 180 });
        persistSession({ ...get(), currentTime });
      }
    };

    youTubeEngine.onPlayStateChange = (isPlaying) => {
      const { currentTrack } = get();
      if (isYouTubeTrack(currentTrack)) {
        set({ isPlaying });
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
      }
    };

    youTubeEngine.onTrackEnded = async () => {
      const { currentTrack, repeat } = get();
      if (isYouTubeTrack(currentTrack)) {
        if (repeat === 'one' && currentTrack) {
          youTubeEngine.seekTo(0);
          youTubeEngine.play();
        } else {
          await get().nextTrack();
        }
      }
    };

    youTubeEngine.onError = (err) => {
      console.warn('YouTube Player notice:', err);
    };

    // 4. Windows Media Session hardware keys
    audioEngine.bindMediaSessionActions({
      onPlay: () => get().togglePlay(),
      onPause: () => get().togglePlay(),
      onNext: () => get().nextTrack(),
      onPrev: () => get().previousTrack(),
      onSeek: (seconds) => get().seek(seconds),
    });

    // 5. Global tab visibility listener to keep audio playing across tab switches
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        const { isPlaying, currentTrack } = get();
        if (isPlaying && currentTrack) {
          if (isYouTubeTrack(currentTrack)) {
            youTubeEngine.play();
          } else {
            audioEngine.resumeContext().catch(() => {});
          }
        }
      });
    }

    // 5. Browser refresh / unload sync
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('beforeunload', () => {
        persistSession(get(), true);
      });
    }
  },

  playTrack: async (track: Track, newQueue?: Track[], targetIndex?: number) => {
    const state = get();
    let queue = state.queue;
    let queueIndex = state.queueIndex;

    if (targetIndex !== undefined) {
      queueIndex = targetIndex;
      if (newQueue && newQueue.length > 0) {
        queue = newQueue;
      }
    } else if (newQueue && newQueue.length > 0) {
      queue = newQueue;
      queueIndex = newQueue.findIndex((t) => t.id === track.id);
      if (queueIndex === -1) queueIndex = 0;
    } else {
      const existingIdx = queue.findIndex((t) => t.id === track.id);
      if (existingIdx !== -1) {
        queueIndex = existingIdx;
      } else {
        queue = [track, ...queue];
        queueIndex = 0;
      }
    }

    lastPrevClickTime = 0;
    lastPrevTrackId = null;

    set({
      currentTrack: track,
      queue,
      queueIndex,
      isPlaying: true,
      currentTime: 0,
      duration: track.duration || 180,
    });

    persistSession(get());

    // Record to history in background (do not await, to preserve synchronous user gesture for browser autoplay)
    db.history.add({
      trackId: track.id,
      playedAt: Date.now(),
    }).catch(() => {});

    // Extract ambient color for UI
    extractDominantColor(track.artworkUrl).then((color) => {
      useUiStore.getState().setAmbientColor(color);
    });

    // Route to appropriate engine with error suppression
    try {
      if (isYouTubeTrack(track)) {
        audioEngine.pause();
        youTubeEngine.setVolume(state.isMuted ? 0 : state.volume);

        // If "Mute Singer" (Sing) mode or Karaoke mode is active, prefer instrumental beat version
        if (state.isVocalMuted || state.isKaraokeMode) {
          if (track.instrumentalYoutubeId) {
            youTubeEngine.loadVideoById(track.instrumentalYoutubeId);
          } else {
            const instVid = await youTubeEngine.searchAndPlayInstrumental(
              `${track.title} ${track.artist}`,
              0
            );
            if (instVid) {
              track.instrumentalYoutubeId = instVid;
            } else if (track.youtubeId) {
              youTubeEngine.loadVideoById(track.youtubeId);
            } else {
              const vid = await youTubeEngine.searchAndPlay(`${track.title} ${track.artist}`);
              if (vid) track.youtubeId = vid;
            }
          }
        } else {
          if (track.youtubeId) {
            youTubeEngine.loadVideoById(track.youtubeId);
          } else {
            const vid = await youTubeEngine.searchAndPlay(`${track.title} ${track.artist}`);
            if (vid) {
              track.youtubeId = vid;
            }
          }
        }

        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: track.album || 'Spotibai',
            artwork: [
              { src: track.artworkUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=512', sizes: '512x512', type: 'image/jpeg' },
              { src: track.artworkUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=256', sizes: '256x256', type: 'image/jpeg' },
            ],
          });
          navigator.mediaSession.playbackState = 'playing';
        }

        // Instant background preloading for adjacent tracks (0ms switching)
        const nextTrack = queue[queueIndex + 1];
        if (nextTrack && isYouTubeTrack(nextTrack) && !nextTrack.youtubeId) {
          youTubeEngine.preloadVideoId(`${nextTrack.title} ${nextTrack.artist}`).then((vid) => {
            if (vid) nextTrack.youtubeId = vid;
          }).catch(() => {});
        }
        const prevTrack = queue[queueIndex - 1];
        if (prevTrack && isYouTubeTrack(prevTrack) && !prevTrack.youtubeId) {
          youTubeEngine.preloadVideoId(`${prevTrack.title} ${prevTrack.artist}`).then((vid) => {
            if (vid) prevTrack.youtubeId = vid;
          }).catch(() => {});
        }
      } else {
        youTubeEngine.pause();
        audioEngine.setMute(state.isMuted);
        audioEngine.setVolume(state.isMuted ? 0 : state.volume);

        const playableTrack: Track = {
          ...track,
          audioUrl: track.audioUrl || '',
        };
        await audioEngine.playTrack(playableTrack);

        if (track.karaokeStems?.isReady) {
          set({ karaokeStatus: 'ready', karaokeStatusText: 'Karaoke Ready ✓' });
        } else {
          set({ karaokeStatus: 'idle', karaokeStatusText: '' });
        }

        // If karaoke mode is active, apply vocal level (mute singer) and check for separated stems
        if (state.isKaraokeMode) {
          audioEngine.setVocalLevel(state.vocalLevel);
          if (track.karaokeStems?.isReady) {
            audioEngine.loadKaraokeStems(
              track.karaokeStems.vocalsUrl,
              track.karaokeStems.instrumentalUrl,
              0,
              true
            );
          } else {
            // Check stem cache or request separation in background
            karaokeService.getStems(track.id).then(async (stems) => {
              if (stems && get().isKaraokeMode && get().currentTrack?.id === track.id) {
                track.karaokeStems = {
                  vocalsUrl: stems.vocalsUrl,
                  instrumentalUrl: stems.instrumentalUrl,
                  isReady: true,
                };
                set({ karaokeStatus: 'ready', karaokeStatusText: 'Karaoke Ready ✓' });
                audioEngine.loadKaraokeStems(
                  stems.vocalsUrl,
                  stems.instrumentalUrl,
                  get().currentTime,
                  get().isPlaying
                );
              }
            }).catch(() => {});
          }
        }

        // Preload next track in queue for instant transitions
        const nextIdx = queueIndex + 1;
        if (nextIdx < queue.length) {
          const nextSong = queue[nextIdx];
          const nextUrl = nextSong.audioUrl?.startsWith('http') && !nextSong.audioUrl.includes('youtube.com') ? nextSong.audioUrl : null;
          if (nextUrl) {
            try {
              const preloader = new Audio();
              preloader.preload = 'auto';
              preloader.src = nextUrl;
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('playTrack invocation error:', err);
    }
  },

  playFullTrack: async (track: Track, newQueue?: Track[]) => {
    const fullTrack: Track = {
      ...track,
      sourceType: 'youtube',
    };
    await get().playTrack(fullTrack, newQueue);
  },

  togglePlay: async () => {
    const state = get();
    if (!state.currentTrack) {
      const allTracks = await db.tracks.toArray();
      if (allTracks.length > 0) {
        await get().playTrack(allTracks[0], allTracks);
        return;
      }
      return;
    }

    try {
      if (isYouTubeTrack(state.currentTrack)) {
        if (state.isPlaying) {
          youTubeEngine.pause();
          set({ isPlaying: false });
        } else {
          youTubeEngine.play();
          set({ isPlaying: true });
        }
      } else {
        if (state.isPlaying) {
          audioEngine.pause();
          set({ isPlaying: false });
        } else {
          await audioEngine.resumeContext();
          const targetTrack: Track = {
            ...state.currentTrack,
            audioUrl: state.currentTrack.audioUrl || '',
          };
          await audioEngine.play(targetTrack, state.currentTime || 0);
          set({ isPlaying: true });
        }
      }
    } catch (err) {
      console.warn('togglePlay invocation error:', err);
    }

    persistSession(get());
  },

  toggleKaraokeMode: async () => {
    const { isKaraokeMode, currentTrack, currentTime } = get();
    const nextMode = !isKaraokeMode;
    // Karaoke Mode explicitly mutes the singer (0% vocals) and plays only the instrumental (100%)
    const targetVocalLevel = nextMode ? 0 : 100;

    set({
      isKaraokeMode: nextMode,
      isVocalMuted: nextMode,
      vocalLevel: targetVocalLevel,
      karaokeError: null,
    });

    audioEngine.setVocalLevel(targetVocalLevel);

    if (!currentTrack) return;

    if (nextMode) {
      // 1. YouTube tracks: if target level is 0, switch to instrumental version
      if (isYouTubeTrack(currentTrack)) {
        if (currentTrack.instrumentalYoutubeId) {
          youTubeEngine.loadVideoById(currentTrack.instrumentalYoutubeId, currentTime);
        } else {
          set({ karaokeStatus: 'processing', karaokeStatusText: 'Locating instrumental beat track...' });
          const instVid = await youTubeEngine.searchAndPlayInstrumental(
            `${currentTrack.title} ${currentTrack.artist}`,
            currentTime
          );
          if (instVid) {
            currentTrack.instrumentalYoutubeId = instVid;
            set({ karaokeStatus: 'ready', karaokeStatusText: 'Karaoke Ready ✓' });
          } else {
            set({ karaokeStatus: 'ready', karaokeStatusText: 'Karaoke Active (Beat Mode)' });
          }
        }
        return;
      }

      // 2. Local / HTML5 tracks: If stems already ready, load instantly
      if (currentTrack.karaokeStems?.isReady) {
        set({
          karaokeStatus: 'ready',
          karaokeStatusText: 'Karaoke Ready ✓',
        });
        await audioEngine.loadKaraokeStems(
          currentTrack.karaokeStems.vocalsUrl,
          currentTrack.karaokeStems.instrumentalUrl,
          get().currentTime || currentTime,
          get().isPlaying
        );
        audioEngine.setVocalLevel(0);
        return;
      }

      set({ karaokeStatus: 'processing', karaokeStatusText: 'Checking separated stems...' });
      try {
        const stems = await karaokeService.separateTrack(currentTrack, (statusText) => {
          set({ karaokeStatusText: statusText });
        });

        if (stems && stems.vocalsUrl && stems.instrumentalUrl) {
          currentTrack.karaokeStems = {
            vocalsUrl: stems.vocalsUrl,
            instrumentalUrl: stems.instrumentalUrl,
            isReady: true,
          };
          set({
            karaokeStatus: 'ready',
            karaokeStatusText: 'Karaoke Ready ✓',
          });

          // If still in karaoke mode and track matches, transition to synchronized stem playback
          if (get().isKaraokeMode && get().currentTrack?.id === currentTrack.id) {
            await audioEngine.loadKaraokeStems(
              stems.vocalsUrl,
              stems.instrumentalUrl,
              get().currentTime || currentTime,
              get().isPlaying
            );
          }
        }
      } catch (err: any) {
        console.warn('Karaoke AI stem separation note:', err);
        set({
          karaokeStatus: 'ready',
          karaokeStatusText: 'Karaoke Active (Real-time vocal filter)',
          karaokeError: 'Backend separation unavailable; using real-time vocal suppressor.',
        });
      }
    } else {
      // Exiting karaoke mode
      set({
        karaokeStatus: 'idle',
        karaokeStatusText: '',
        karaokeError: null,
      });

      if (isYouTubeTrack(currentTrack)) {
        if (currentTrack.youtubeId) {
          youTubeEngine.loadVideoById(currentTrack.youtubeId, currentTime);
        }
      } else {
        if (audioEngine.getIsStemMode()) {
          audioEngine.unloadKaraokeStems(true, currentTime);
        }
      }
    }
  },

  setVocalLevel: (level: number) => {
    const safeLevel = Math.max(0, Math.min(100, Math.round(level)));
    const isMuted = safeLevel === 0;
    set({
      vocalLevel: safeLevel,
      isVocalMuted: isMuted,
      isKaraokeMode: safeLevel < 100 ? true : get().isKaraokeMode,
    });

    audioEngine.setVocalLevel(safeLevel);

    const { currentTrack, currentTime } = get();
    if (currentTrack && isYouTubeTrack(currentTrack)) {
      if (safeLevel === 0 && currentTrack.instrumentalYoutubeId && youTubeEngine.currentVideoId !== currentTrack.instrumentalYoutubeId) {
        youTubeEngine.loadVideoById(currentTrack.instrumentalYoutubeId, currentTime);
      } else if (safeLevel > 50 && currentTrack.youtubeId && youTubeEngine.currentVideoId !== currentTrack.youtubeId) {
        youTubeEngine.loadVideoById(currentTrack.youtubeId, currentTime);
      }
    }
  },

  toggleVocalMute: async () => {
    const { isKaraokeMode, vocalLevel } = get();
    if (!isKaraokeMode) {
      await get().toggleKaraokeMode();
    } else {
      if (vocalLevel === 0) {
        get().setVocalLevel(100);
      } else {
        get().setVocalLevel(0);
      }
    }
  },

  nextTrack: async () => {
    const { queue, queueIndex, shuffle, repeat, currentTrack } = get();
    if (queue.length === 0) return;

    let nextIdx = queueIndex + 1;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (nextIdx >= queue.length) {
      if (repeat === 'all') {
        nextIdx = 0;
      } else {
        // End of current queue reached with repeat 'off' -> Trigger Spotify Autoplay
        if (currentTrack) {
          try {
            const recentHistory = await db.history.orderBy('playedAt').reverse().limit(15).toArray();
            const historyIds = recentHistory.map((h) => h.trackId);
            const recommendations = await autoplayEngine.getNextRecommendations(
              currentTrack,
              queue,
              historyIds,
              5
            );

            if (recommendations.length > 0) {
              const updatedQueue = [...queue, ...recommendations];
              const nextSong = recommendations[0];
              const newQueueIdx = queue.length;

              set({
                queue: updatedQueue,
                queueIndex: newQueueIdx,
              });

              await get().playTrack(nextSong, undefined, newQueueIdx);
              return;
            }
          } catch (autoErr) {
            console.warn('Autoplay engine notice:', autoErr);
          }
        }

        set({ isPlaying: false });
        return;
      }
    }

    const nextSong = queue[nextIdx];
    if (nextSong) {
      await get().playTrack(nextSong, undefined, nextIdx);
    }
  },

  previousTrack: async () => {
    const { queue, queueIndex, currentTime } = get();

    // Spotify UX standard:
    // If playing past 3 seconds, restart current track to 0:00
    if (currentTime > 3) {
      get().seek(0);
      set({ currentTime: 0 });
      return;
    }

    if (queue.length === 0) return;

    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      if (get().repeat === 'all') {
        prevIdx = queue.length - 1;
      } else {
        // At beginning of queue: restart to 0:00
        get().seek(0);
        set({ currentTime: 0 });
        return;
      }
    }

    const prevTrack = queue[prevIdx];
    if (prevTrack) {
      await get().playTrack(prevTrack, undefined, prevIdx);
    }
  },

  seek: (seconds: number) => {
    if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      seconds = 0;
    }
    const { currentTrack, duration } = get();
    const maxDuration = duration > 0 ? duration : (currentTrack?.duration || 0);
    if (maxDuration > 0) {
      seconds = Math.min(seconds, maxDuration);
    }
    if (isYouTubeTrack(currentTrack)) {
      youTubeEngine.seekTo(seconds);
    } else {
      audioEngine.seek(seconds);
    }
    set({ currentTime: seconds });
    persistSession(get());
  },

  setVolume: (vol: number) => {
    if (!Number.isFinite(vol) || isNaN(vol)) vol = 0.8;
    const safeVol = Math.max(0, Math.min(1, vol));
    audioEngine.setVolume(safeVol);
    youTubeEngine.setVolume(safeVol);
    const updates: Partial<PlayerState> = {
      volume: safeVol,
      isMuted: safeVol === 0,
    };
    if (safeVol > 0) {
      updates.previousVolume = safeVol;
    }
    set(updates as any);
    persistSession(get());
  },

  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get();
    const newMuted = !isMuted;
    if (newMuted) {
      // Muting: remember current non-zero volume
      const rememberVol = volume > 0 ? volume : (previousVolume || 0.8);
      audioEngine.setMute(true);
      youTubeEngine.setMute(true);
      set({ isMuted: true, volume: 0, previousVolume: rememberVol });
    } else {
      // Unmuting: restore remembered custom volume
      const restoreVol = previousVolume && previousVolume > 0 ? previousVolume : (volume > 0 ? volume : 0.8);
      audioEngine.setMute(false);
      youTubeEngine.setMute(false);
      audioEngine.setVolume(restoreVol);
      youTubeEngine.setVolume(restoreVol);
      set({ isMuted: false, volume: restoreVol });
    }
    persistSession(get());
  },

  toggleShuffle: () => {
    set((state) => {
      const next = !state.shuffle;
      persistSession({ ...state, shuffle: next });
      return { shuffle: next };
    });
  },

  toggleRepeat: () => {
    set((state) => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const nextMode = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
      persistSession({ ...state, repeat: nextMode });
      return { repeat: nextMode };
    });
  },

  addToQueue: (track: Track) => {
    set((state) => {
      const newQueue = [...state.queue, track];
      persistSession({ ...state, queue: newQueue });
      return { queue: newQueue };
    });
  },

  removeFromQueue: (index: number) => {
    set((state) => {
      const newQueue = [...state.queue];
      newQueue.splice(index, 1);
      persistSession({ ...state, queue: newQueue });
      return { queue: newQueue };
    });
  },

  clearQueue: () => {
    const { currentTrack } = get();
    const newQueue = currentTrack ? [currentTrack] : [];
    set({ queue: newQueue, queueIndex: 0 });
    persistSession(get());
  },

  setCrossfade: (seconds: number) => {
    audioEngine.crossfadeDuration = seconds;
    set({ crossfade: seconds });
  },

  setEqGain: (bandIndex: number, gain: number) => {
    audioEngine.setEqBandGain(bandIndex, gain);
    set((state) => {
      const newGains = [...state.eqGains];
      newGains[bandIndex] = gain;
      return { eqGains: newGains, activePresetId: 'custom' };
    });
  },

  applyPreset: (presetId: string) => {
    const preset = EQ_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      audioEngine.applyPreset(preset);
      set({ activePresetId: presetId, eqGains: [...preset.gains] });
    }
  },
}));
