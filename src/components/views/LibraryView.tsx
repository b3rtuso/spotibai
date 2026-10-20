import React, { useState } from 'react';
import { Plus, FolderPlus, Heart, ArrowDownCircle, FolderOpen, Play } from 'lucide-react';
import { useLibraryStore } from '../../store/libraryStore';
import { useUiStore } from '../../store/uiStore';
import { usePlayerStore } from '../../store/playerStore';

export const LibraryView: React.FC = () => {
  const { playlists, tracks } = useLibraryStore();
  const { setActiveView, setSelectedPlaylistId, setImportModalOpen } = useUiStore();
  const { playTrack } = usePlayerStore();
  const [filterTab, setFilterTab] = useState<'all' | 'playlists' | 'downloaded' | 'local'>('all');

  const likedTracks = tracks.filter((t) => t.isLiked);
  const downloadedTracks = tracks.filter((t) => t.isDownloaded);
  const localTracks = tracks.filter((t) => t.sourceType === 'local');

  return (
    <div className="p-4 sm:p-6 md:p-8 pb-32 space-y-5 sm:space-y-6 select-none">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Your Library</h1>
          <p className="text-xs text-spotify-subtext mt-0.5">Manage your playlists, downloads, and local songs</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-all"
          >
            <FolderPlus className="w-4 h-4 text-spotify-green" />
            <span>Import Local Files</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs (Horizontally scrollable on mobile) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0 ${
            filterTab === 'all'
              ? 'bg-white text-black'
              : 'bg-white/10 text-white hover:bg-white/15'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterTab('playlists')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
            filterTab === 'playlists'
              ? 'bg-white text-black'
              : 'bg-white/10 text-white hover:bg-white/15'
          }`}
        >
          Playlists
        </button>
        <button
          onClick={() => setFilterTab('downloaded')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
            filterTab === 'downloaded'
              ? 'bg-white text-black'
              : 'bg-white/10 text-white hover:bg-white/15'
          }`}
        >
          Downloaded ({downloadedTracks.length})
        </button>
        <button
          onClick={() => setFilterTab('local')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
            filterTab === 'local'
              ? 'bg-white text-black'
              : 'bg-white/10 text-white hover:bg-white/15'
          }`}
        >
          Local Files ({localTracks.length})
        </button>
      </div>

      {/* Grid of collections */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {/* Liked Songs Tile */}
        {(filterTab === 'all' || filterTab === 'playlists') && (
          <div
            onClick={() => setActiveView('liked')}
            className="group relative bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 p-4 rounded-xl cursor-pointer hover:scale-[1.02] transition-transform shadow-lg flex flex-col justify-end aspect-square"
          >
            <div className="mb-auto">
              <Heart className="w-8 h-8 fill-white text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Liked Songs</h3>
              <p className="text-xs text-white/80 font-medium">{likedTracks.length} tracks</p>
            </div>
            <div className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
              <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
            </div>
          </div>
        )}

        {/* Downloaded Offline Tile */}
        {(filterTab === 'all' || filterTab === 'downloaded') && (
          <div
            onClick={() => setActiveView('downloaded')}
            className="group relative bg-gradient-to-br from-emerald-800 to-teal-700 p-4 rounded-xl cursor-pointer hover:scale-[1.02] transition-transform shadow-lg flex flex-col justify-end aspect-square"
          >
            <div className="mb-auto">
              <ArrowDownCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Downloaded</h3>
              <p className="text-xs text-white/80 font-medium">{downloadedTracks.length} tracks offline</p>
            </div>
            <div className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
              <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
            </div>
          </div>
        )}

        {/* Local Files Tile */}
        {(filterTab === 'all' || filterTab === 'local') && (
          <div
            onClick={() => setActiveView('local')}
            className="group relative bg-gradient-to-br from-blue-800 to-cyan-700 p-4 rounded-xl cursor-pointer hover:scale-[1.02] transition-transform shadow-lg flex flex-col justify-end aspect-square"
          >
            <div className="mb-auto">
              <FolderOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Local Files</h3>
              <p className="text-xs text-white/80 font-medium">{localTracks.length} local files</p>
            </div>
            <div className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
              <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
            </div>
          </div>
        )}

        {/* Playlists Tiles */}
        {(filterTab === 'all' || filterTab === 'playlists') &&
          playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => setSelectedPlaylistId(pl.id)}
              className="group relative bg-spotify-card hover:bg-spotify-cardHover p-4 rounded-xl cursor-pointer transition-all duration-300 shadow-md flex flex-col"
            >
              <div className="aspect-square w-full rounded-lg overflow-hidden mb-3 bg-neutral-800 relative shadow-lg">
                <img src={pl.coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
                  <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
                </div>
              </div>
              <h3 className="font-bold text-sm text-white truncate mb-1">{pl.name}</h3>
              <p className="text-xs text-spotify-subtext truncate">
                {pl.isCustom ? 'Custom Playlist' : 'Spotibai Playlist'} • {pl.trackIds.length} songs
              </p>
            </div>
          ))}
      </div>
    </div>
  );
};
