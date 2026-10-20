import React from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Maximize2 } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useUiStore } from '../../store/uiStore';
import { formatTime } from '../../utils/colorExtractor';

export const MiniPlayer: React.FC = () => {
  const { isMiniPlayer, toggleMiniPlayer } = useUiStore();
  const { currentTrack, isPlaying, togglePlay, nextTrack, previousTrack, currentTime, duration } = usePlayerStore();

  if (!isMiniPlayer || !currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-28 right-6 z-50 w-72 bg-neutral-900/95 border border-white/20 rounded-2xl shadow-2xl backdrop-blur-xl p-4 select-none animate-in zoom-in-95 duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-spotify-green">
          Mini Player
        </span>
        <button
          onClick={toggleMiniPlayer}
          className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Album Artwork */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 shadow-lg group">
        <img
          src={currentTrack.artworkUrl}
          alt={currentTrack.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{currentTrack.title}</h3>
            <p className="text-xs text-neutral-300 truncate">{currentTrack.artist}</p>
          </div>
        </div>
      </div>

      {/* Mini Progress */}
      <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden mb-3">
        <div
          className="bg-spotify-green h-full rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-neutral-400 tabular-nums">
          {formatTime(currentTime)}
        </span>

        <div className="flex items-center gap-3">
          <button onClick={previousTrack} className="text-neutral-400 hover:text-white">
            <SkipBack className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-black stroke-black" />
            ) : (
              <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
            )}
          </button>
          <button onClick={nextTrack} className="text-neutral-400 hover:text-white">
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>

        <span className="text-[10px] text-neutral-400 tabular-nums">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};
