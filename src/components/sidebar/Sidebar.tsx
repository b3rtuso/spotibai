import React, { useState } from 'react';
import { 
  Home, 
  Search, 
  Library, 
  PlusSquare, 
  Heart, 
  FolderPlus, 
  FolderOpen,
  Music,
  Trash2
} from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useLibraryStore } from '../../store/libraryStore';

export const Sidebar: React.FC = () => {
  const { 
    activeView, 
    setActiveView, 
    setSelectedPlaylistId, 
    selectedPlaylistId, 
    setImportModalOpen, 
    setSpotifyImportModalOpen
  } = useUiStore();
  const { playlists, tracks, createPlaylist, deletePlaylist } = useLibraryStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const likedCount = tracks.filter((t) => t.isLiked).length;
  const localCount = tracks.filter((t) => t.sourceType === 'local').length;

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      const created = await createPlaylist(newPlaylistName.trim());
      setSelectedPlaylistId(created.id);
      setNewPlaylistName('');
      setIsCreating(false);
    }
  };

  return (
    <aside className="hidden md:flex w-64 bg-black flex-col h-full border-r border-spotify-border/40 select-none flex-shrink-0 z-20">
      {/* Brand Header */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div 
          onClick={() => setActiveView('home')} 
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-full bg-spotify-green flex items-center justify-center text-black font-black text-xl shadow-lg shadow-spotify-green/20 group-hover:scale-105 transition-transform">
            <Music className="w-5 h-5 fill-black stroke-black" />
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-tight">
              <span>Spotibai</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="px-3 space-y-1">
        <button
          onClick={() => setActiveView('home')}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
            activeView === 'home'
              ? 'bg-spotify-highlight text-white'
              : 'text-spotify-subtext hover:text-white hover:bg-white/5'
          }`}
        >
          <Home className={`w-6 h-6 ${activeView === 'home' ? 'text-white' : ''}`} />
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveView('search')}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
            activeView === 'search'
              ? 'bg-spotify-highlight text-white'
              : 'text-spotify-subtext hover:text-white hover:bg-white/5'
          }`}
        >
          <Search className={`w-6 h-6 ${activeView === 'search' ? 'text-white' : ''}`} />
          <span>Search</span>
        </button>

        <button
          onClick={() => setActiveView('library')}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
            activeView === 'library'
              ? 'bg-spotify-highlight text-white'
              : 'text-spotify-subtext hover:text-white hover:bg-white/5'
          }`}
        >
          <Library className={`w-6 h-6 ${activeView === 'library' ? 'text-white' : ''}`} />
          <span>Your Library</span>
        </button>
      </nav>

      {/* Quick Library Categories */}
      <div className="pt-4 px-3 space-y-1">
        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold text-spotify-subtext hover:text-white hover:bg-white/5 transition-all group"
        >
          <div className="w-7 h-7 rounded bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors">
            <PlusSquare className="w-4 h-4" />
          </div>
          <span>Create Playlist</span>
        </button>

        <button
          onClick={() => setActiveView('liked')}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all group ${
            activeView === 'liked'
              ? 'bg-spotify-highlight text-white'
              : 'text-spotify-subtext hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-700 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-sm">
              <Heart className="w-4 h-4 fill-white" />
            </div>
            <span>Liked Songs</span>
          </div>
          <span className="text-xs text-spotify-subdued">{likedCount}</span>
        </button>

        <button
          onClick={() => setActiveView('local')}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all group ${
            activeView === 'local'
              ? 'bg-spotify-highlight text-white'
              : 'text-spotify-subtext hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
            <span>Local Files</span>
          </div>
          <span className="text-xs text-spotify-subdued">{localCount}</span>
        </button>

        <button
          onClick={() => setSpotifyImportModalOpen(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all group text-spotify-subtext hover:text-white hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-spotify-green text-black flex items-center justify-center font-black shadow-md">
              <Music className="w-4 h-4 fill-black stroke-black" />
            </div>
            <span>Import from Spotify</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-spotify-green px-1.5 py-0.5 rounded bg-spotify-green/20">
            Link
          </span>
        </button>
      </div>

      {/* Playlist Creator Form inline */}
      {isCreating && (
        <form onSubmit={handleCreatePlaylist} className="mx-3 mt-2 p-2 bg-spotify-elevated rounded-lg border border-white/10">
          <input
            type="text"
            placeholder="Playlist name..."
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-white px-2 py-1 outline-none border-b border-spotify-green placeholder-neutral-500"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-neutral-400 hover:text-white px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs bg-spotify-green text-black font-bold px-3 py-1 rounded-full hover:scale-105 transition-transform"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <hr className="border-spotify-border/60 mx-5 my-3" />

      {/* Playlists List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-0.5">
        <div className="text-[11px] font-bold text-spotify-subdued uppercase tracking-wider mb-2 px-2">
          Playlists
        </div>
        {playlists.map((playlist) => {
          const isSelected = activeView === 'playlist' && selectedPlaylistId === playlist.id;
          return (
            <div
              key={playlist.id}
              onClick={() => setSelectedPlaylistId(playlist.id)}
              className={`group flex items-center justify-between px-2.5 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                isSelected
                  ? 'text-spotify-green bg-white/5 font-semibold'
                  : 'text-spotify-subtext hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="truncate pr-2">{playlist.name}</span>
              {playlist.isCustom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePlaylist(playlist.id);
                  }}
                  title="Delete playlist"
                  className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Import Local Files Quick Button */}
      <div className="p-3 border-t border-spotify-border/40">
        <button
          onClick={() => setImportModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 hover:border-white/20 transition-all hover:scale-[1.02]"
        >
          <FolderPlus className="w-4 h-4 text-spotify-green" />
          <span>Import Music From PC</span>
        </button>
      </div>
    </aside>
  );
};
