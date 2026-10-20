import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Heart, 
  DownloadCloud, 
  CheckCircle2, 
  MoreHorizontal, 
  Volume2,
  FolderDown,
  ListPlus,
  Trash2
} from 'lucide-react';
import { Track } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useUiStore } from '../../store/uiStore';
import { formatTime } from '../../utils/colorExtractor';

interface TrackRowProps {
  track: Track;
  index: number;
  playlistContext?: Track[];
  currentPlaylistId?: string | null;
  onRemoveFromPlaylist?: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  playlistContext,
  currentPlaylistId,
  onRemoveFromPlaylist,
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayerStore();
  const { tracks, toggleLike, downloadTrack, downloadProgress, exportTrack, playlists, addTrackToPlaylist } = useLibraryStore();
  const [showMenu, setShowMenu] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const isDownloading = !!downloadProgress[track.id];
  const libTrack = tracks.find((t) => t.id === track.id);
  const isLiked = libTrack !== undefined ? Boolean(libTrack.isLiked) : Boolean(track.isLiked);
  const isDownloaded = libTrack !== undefined ? Boolean(libTrack.isDownloaded) : Boolean(track.isDownloaded);

  const handleRowClick = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, playlistContext);
    }
  };

  return (
    <div
      onClick={handleRowClick}
      className={`group relative flex items-center gap-2.5 sm:gap-4 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
        isCurrent
          ? 'bg-white/10 text-spotify-green'
          : 'text-neutral-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      {/* 1. Track Index / Play Indicator */}
      <div className="w-6 flex items-center justify-center flex-shrink-0 text-spotify-subdued group-hover:text-white">
        {isCurrent && isPlaying ? (
          <Volume2 className="w-4 h-4 text-spotify-green animate-pulse" />
        ) : (
          <>
            <span className="group-hover:hidden tabular-nums text-xs">{index + 1}</span>
            <Play className="w-3.5 h-3.5 fill-current hidden group-hover:block ml-0.5" />
          </>
        )}
      </div>

      {/* 2. Artwork & Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded overflow-hidden bg-neutral-800 flex-shrink-0 shadow">
          <img
            src={track.artworkUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80';
            }}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span
            className={`font-semibold truncate text-sm ${
              isCurrent ? 'text-spotify-green' : 'text-white'
            }`}
          >
            {track.title}
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              useUiStore.getState().setSelectedArtist(track.artist);
            }}
            className="text-xs text-spotify-subtext truncate group-hover:text-neutral-300 hover:text-white hover:underline cursor-pointer"
          >
            {track.artist}
          </span>
        </div>
      </div>

      {/* 3. Album */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          // If album is clicked, trigger search or artist
          useUiStore.getState().setSelectedArtist(track.artist);
        }}
        className="hidden md:block flex-1 min-w-0 text-xs text-spotify-subtext truncate hover:text-white hover:underline cursor-pointer"
      >
        {track.album || 'Single'}
      </div>

      {/* 4. Genre */}
      <div className="hidden lg:flex items-center w-32 text-xs text-spotify-subtext truncate">
        {track.genre || ''}
      </div>

      {/* 5. Like & Download Actions */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => toggleLike(track.id, track)}
          title={isLiked ? 'Unlike' : 'Like'}
          className={`p-1.5 sm:p-2 transition-colors ${
            isLiked
              ? 'text-spotify-green'
              : 'text-neutral-400 md:text-neutral-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-spotify-green text-spotify-green' : ''}`} />
        </button>

        {/* Hide download button on Liked Songs view */}
        {useUiStore.getState().activeView !== 'liked' && (
          isDownloaded ? (
            <div title="Downloaded for offline listening" className="p-1.5 sm:p-2 text-spotify-green">
              <CheckCircle2 className="w-4 h-4 fill-spotify-green text-black" />
            </div>
          ) : (
            <button
              onClick={() => downloadTrack(track)}
              disabled={isDownloading}
              title="Download track offline"
              className="p-1.5 sm:p-2 text-neutral-400 md:text-neutral-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-spotify-green transition-all"
            >
              {isDownloading ? (
                <div className="w-4 h-4 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
              ) : (
                <DownloadCloud className="w-4 h-4" />
              )}
            </button>
          )
        )}

        {/* Context Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            title="More options"
            className="p-1.5 sm:p-2 text-neutral-400 md:text-neutral-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-white transition-opacity"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 z-50 w-52 bg-spotify-elevated border border-white/10 rounded-xl shadow-2xl py-1 text-xs select-none">
              <button
                onClick={() => {
                  addToQueue(track);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-neutral-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
              >
                <ListPlus className="w-4 h-4" />
                <span>Add to Queue</span>
              </button>

              <button
                onClick={() => {
                  exportTrack(track);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-neutral-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
              >
                <FolderDown className="w-4 h-4 text-spotify-green" />
                <span>Save MP3 to Computer</span>
              </button>

              {onRemoveFromPlaylist && (
                <button
                  onClick={() => {
                    onRemoveFromPlaylist();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-red-400 hover:text-red-300 hover:bg-white/10 flex items-center gap-2 border-t border-white/5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove from this playlist</span>
                </button>
              )}

              {playlists.length > 0 && (
                <div className="border-t border-white/10 my-1 pt-1">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-neutral-500">
                    Add to Playlist
                  </div>
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => {
                        addTrackToPlaylist(pl.id, track.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-neutral-300 hover:text-white hover:bg-white/10 truncate"
                    >
                      {pl.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. Duration */}
      <div className="w-12 text-right text-xs text-spotify-subdued tabular-nums flex-shrink-0">
        {formatTime(track.duration)}
      </div>
    </div>
  );
};
