import React, { useState } from 'react';
import { 
  Play, 
  Heart, 
  ArrowDownCircle, 
  CheckCircle2, 
  FolderPlus, 
  Shuffle, 
  Trash2, 
  Clock,
  Sparkles,
  DownloadCloud,
  Pencil,
  Search,
  ArrowUpDown,
  X
} from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useLibraryStore } from '../../store/libraryStore';
import { usePlayerStore } from '../../store/playerStore';
import { TrackRow } from '../common/TrackRow';
import { Track } from '../../types';
import { formatTime } from '../../utils/colorExtractor';

export const PlaylistView: React.FC = () => {
  const { activeView, selectedPlaylistId, setImportModalOpen, openEditPlaylist } = useUiStore();
  const { tracks, playlists, deletePlaylist, downloadPlaylist, removeTrackFromPlaylist } = useLibraryStore();
  const { playTrack, toggleShuffle, shuffle } = usePlayerStore();

  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<'custom' | 'title' | 'artist' | 'album' | 'duration' | 'dateAdded'>('custom');

  let title = 'Playlist';
  let description = '';
  let coverUrl = '';
  let displayTracks: Track[] = [];
  let isCustom = false;
  let isDownloaded = false;
  let playlistId: string | null = null;
  let badge = 'PLAYLIST';

  if (activeView === 'liked') {
    title = 'Liked Songs';
    badge = 'AUTO PLAYLIST';
    description = 'Your favorite saved tracks in one place.';
    coverUrl = 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=80';
    displayTracks = tracks.filter((t) => t.isLiked);
  } else if (activeView === 'downloaded') {
    title = 'Downloaded Offline';
    badge = 'OFFLINE STORAGE';
    description = 'Tracks stored in your browser for seamless playback without internet.';
    coverUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';
    displayTracks = tracks.filter((t) => t.isDownloaded);
    isDownloaded = true;
  } else if (activeView === 'local') {
    title = 'Local Files';
    badge = 'DEVICE STORAGE';
    description = 'Audio files imported directly from your computer.';
    coverUrl = 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80';
    displayTracks = tracks.filter((t) => t.sourceType === 'local');
    isDownloaded = true;
  } else {
    const pl = playlists.find((p) => p.id === selectedPlaylistId);
    if (pl) {
      title = pl.name;
      description = pl.description || 'Curated playlist on Spotibai.';
      coverUrl = pl.coverUrl;
      displayTracks = pl.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is Track => t !== undefined);
      isCustom = pl.isCustom;
      isDownloaded = !!pl.isDownloaded;
      playlistId = pl.id;
    }
  }

  // Filter & Sort
  let processedTracks = [...displayTracks];
  if (filterQuery.trim()) {
    const q = filterQuery.toLowerCase();
    processedTracks = processedTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }

  if (sortBy === 'title') {
    processedTracks.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === 'artist') {
    processedTracks.sort((a, b) => a.artist.localeCompare(b.artist));
  } else if (sortBy === 'album') {
    processedTracks.sort((a, b) => (a.album || '').localeCompare(b.album || ''));
  } else if (sortBy === 'duration') {
    processedTracks.sort((a, b) => (a.duration || 0) - (b.duration || 0));
  } else if (sortBy === 'dateAdded') {
    processedTracks.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
  }

  const totalDurationSecs = processedTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMins = Math.floor(totalDurationSecs / 60);

  const handlePlayAll = () => {
    if (processedTracks.length > 0) {
      playTrack(processedTracks[0], processedTracks);
    }
  };

  return (
    <div className="pb-32 select-none">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 md:p-8 pb-6 flex flex-col sm:flex-row items-center sm:items-end text-center sm:text-left gap-5 sm:gap-6 bg-gradient-to-b from-white/10 to-transparent">
        {/* Cover Artwork */}
        <div 
          onClick={() => isCustom && playlistId && openEditPlaylist(playlistId)}
          className={`w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-xl overflow-hidden shadow-2xl bg-neutral-800 flex-shrink-0 relative group ${
            isCustom && playlistId ? 'cursor-pointer' : ''
          }`}
          title={isCustom && playlistId ? 'Click to edit playlist' : title}
        >
          <img src={coverUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          {isCustom && playlistId && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity">
              <Pencil className="w-8 h-8 text-white" />
              <span className="text-xs font-bold text-white">Edit details</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1.5 sm:gap-2 min-w-0">
          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-white/80">
            {badge}
          </span>
          <h1 
            onClick={() => isCustom && playlistId && openEditPlaylist(playlistId)}
            className={`text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight line-clamp-2 ${
              isCustom && playlistId ? 'cursor-pointer hover:underline' : ''
            }`}
          >
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-spotify-subtext mt-0.5">{description}</p>

          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-neutral-300 mt-2">
            <span className="text-white font-bold">Spotibai</span>
            <span>•</span>
            <span>{processedTracks.length} song{processedTracks.length === 1 ? '' : 's'}</span>
            <span>•</span>
            <span className="text-spotify-subdued">about {totalMins} min</span>
          </div>
        </div>
      </div>

      {/* Action Controls Bar */}
      <div className="px-4 sm:px-8 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Big Green Play Button */}
          <button
            onClick={handlePlayAll}
            disabled={processedTracks.length === 0}
            title="Play All"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-spotify-green text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl disabled:opacity-50 disabled:scale-100"
          >
            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-black stroke-black ml-0.5" />
          </button>

          {/* Shuffle Toggle */}
          <button
            onClick={toggleShuffle}
            title={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
            className={`p-2 transition-colors ${
              shuffle ? 'text-spotify-green' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Shuffle className="w-6 h-6" />
          </button>

          {/* Download Playlist Button */}
          {playlistId && (
            <button
              onClick={() => downloadPlaylist(playlistId!)}
              title="Download entire playlist for offline listening"
              className={`p-2 rounded-full transition-colors ${
                isDownloaded
                  ? 'text-spotify-green'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {isDownloaded ? (
                <CheckCircle2 className="w-6 h-6 fill-spotify-green text-black" />
              ) : (
                <DownloadCloud className="w-6 h-6" />
              )}
            </button>
          )}

          {/* Edit Playlist Details Button for custom playlists */}
          {isCustom && playlistId && (
            <button
              onClick={() => openEditPlaylist(playlistId!)}
              title="Edit playlist details"
              className="p-2 text-neutral-400 hover:text-white transition-colors"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}

          {/* For Local Files: Import button */}
          {activeView === 'local' && (
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
            >
              <FolderPlus className="w-4 h-4 text-spotify-green" />
              <span>Import Audio Files</span>
            </button>
          )}

          {/* Delete Playlist button for custom playlists */}
          {isCustom && playlistId && (
            <button
              onClick={() => deletePlaylist(playlistId!)}
              title="Delete Playlist"
              className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search / Filter & Sort Controls */}
        <div className="flex items-center gap-3">
          {/* Find in playlist filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Find in playlist"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white text-xs pl-9 pr-7 py-2 rounded-full outline-none w-36 sm:w-48 transition-all placeholder-neutral-400 border border-transparent focus:border-white/20"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 text-xs text-neutral-300 transition-colors">
            <ArrowUpDown className="w-3.5 h-3.5 text-spotify-green" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer"
            >
              <option value="custom" className="bg-neutral-900 text-white">Custom order</option>
              <option value="title" className="bg-neutral-900 text-white">Title</option>
              <option value="artist" className="bg-neutral-900 text-white">Artist</option>
              <option value="album" className="bg-neutral-900 text-white">Album</option>
              <option value="duration" className="bg-neutral-900 text-white">Duration</option>
              <option value="dateAdded" className="bg-neutral-900 text-white">Date added</option>
            </select>
          </div>
        </div>
      </div>

      {/* Track List Table */}
      <div className="px-2 sm:px-4 md:px-8">
        {/* Local Files Import Banner */}
        {activeView === 'local' && (
          <div
            onClick={() => setImportModalOpen(true)}
            className="mb-5 p-4 rounded-xl border border-dashed border-white/20 hover:border-spotify-green bg-white/5 hover:bg-spotify-green/5 cursor-pointer flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-spotify-green/20 text-spotify-green flex items-center justify-center group-hover:scale-105 transition-transform">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white group-hover:text-spotify-green transition-colors">
                  Import Audio Files or Folder
                </p>
                <p className="text-xs text-neutral-400">
                  Full 3–5+ minute playback with 100% offline storage in your browser
                </p>
              </div>
            </div>
            <button className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:scale-105 transition-transform">
              Choose Files
            </button>
          </div>
        )}

        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-spotify-subdued uppercase tracking-wider border-b border-white/10 mb-2">
          <div className="col-span-1 flex items-center justify-center">#</div>
          <div className="col-span-6 md:col-span-5">Title</div>
          <div className="hidden md:block col-span-4">Album</div>
          <div className="col-span-5 md:col-span-2 flex items-center justify-end pr-2">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Empty state */}
        {processedTracks.length === 0 ? (
          <div className="py-20 text-center text-neutral-500">
            <p className="text-base font-semibold mb-2">
              {filterQuery ? `No tracks found matching "${filterQuery}"` : 'It looks empty here'}
            </p>
            {activeView === 'local' ? (
              <button
                onClick={() => setImportModalOpen(true)}
                className="mt-2 px-5 py-2.5 rounded-full bg-spotify-green text-black font-bold text-xs hover:scale-105 transition-transform"
              >
                Import Music from your PC
              </button>
            ) : filterQuery ? (
              <button
                onClick={() => setFilterQuery('')}
                className="text-xs text-spotify-green hover:underline"
              >
                Clear filter
              </button>
            ) : (
              <p className="text-xs">Browse songs or search to add music to this list!</p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {processedTracks.map((track, idx) => (
              <TrackRow
                key={`${track.id}-${idx}`}
                track={track}
                index={idx}
                playlistContext={processedTracks}
                currentPlaylistId={playlistId}
                onRemoveFromPlaylist={
                  isCustom && playlistId
                    ? () => removeTrackFromPlaylist(playlistId!, track.id)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
