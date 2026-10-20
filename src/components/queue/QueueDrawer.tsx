import React from 'react';
import { X, Trash2, Play, Volume2 } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useUiStore } from '../../store/uiStore';
import { formatTime } from '../../utils/colorExtractor';

export const QueueDrawer: React.FC = () => {
  const { isQueueOpen, toggleQueue } = useUiStore();
  const { currentTrack, queue, queueIndex, playTrack, removeFromQueue, clearQueue, isPlaying } = usePlayerStore();

  if (!isQueueOpen) return null;

  const upNextTracks = queue.slice(queueIndex + 1);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:w-96 max-w-full bg-spotify-card border-l border-white/10 shadow-2xl flex flex-col select-none animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-5 flex items-center justify-between border-b border-white/10">
        <h2 className="text-lg font-bold text-white">Play Queue</h2>
        <div className="flex items-center gap-2">
          {upNextTracks.length > 0 && (
            <button
              onClick={clearQueue}
              className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={toggleQueue}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Now Playing */}
        <div>
          <div className="text-xs font-bold text-spotify-subdued uppercase tracking-wider mb-3">
            Now Playing
          </div>
          {currentTrack ? (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/10">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-800">
                <img
                  src={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-spotify-green animate-pulse" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-spotify-green truncate">
                  {currentTrack.title}
                </div>
                <div className="text-xs text-spotify-subtext truncate">
                  {currentTrack.artist}
                </div>
              </div>
              <span className="text-xs text-neutral-400 tabular-nums">
                {formatTime(currentTrack.duration)}
              </span>
            </div>
          ) : (
            <div className="text-xs text-neutral-500 italic p-2">No song is currently playing</div>
          )}
        </div>

        {/* Up Next */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-spotify-subdued uppercase tracking-wider">
              Next Up ({upNextTracks.length})
            </span>
          </div>

          {upNextTracks.length === 0 ? (
            <div className="text-xs text-neutral-500 italic p-2">
              Queue is empty. Select any song or playlist to add to queue!
            </div>
          ) : (
            <div className="space-y-1">
              {upNextTracks.map((track, relativeIdx) => {
                const actualQueueIdx = queueIndex + 1 + relativeIdx;
                return (
                  <div
                    key={`${track.id}-${actualQueueIdx}`}
                    className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => playTrack(track)}
                  >
                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-neutral-800 relative">
                      <img
                        src={track.artworkUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 fill-white stroke-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate group-hover:text-spotify-green">
                        {track.title}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        {track.artist}
                      </div>
                    </div>

                    <span className="text-[11px] text-neutral-500 tabular-nums">
                      {formatTime(track.duration)}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(actualQueueIdx);
                      }}
                      title="Remove from queue"
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
