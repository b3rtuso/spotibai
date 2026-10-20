import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Music, Save } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useLibraryStore } from '../../store/libraryStore';

export const EditPlaylistModal: React.FC = () => {
  const { isEditPlaylistOpen, closeEditPlaylist, editingPlaylistId } = useUiStore();
  const { playlists, updatePlaylist } = useLibraryStore();

  const playlist = playlists.find((p) => p.id === editingPlaylistId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  useEffect(() => {
    if (playlist) {
      setName(playlist.name);
      setDescription(playlist.description || '');
      setCoverUrl(playlist.coverUrl || '');
    }
  }, [playlist]);

  if (!isEditPlaylistOpen || !playlist) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await updatePlaylist(playlist.id, {
      name: name.trim(),
      description: description.trim(),
      coverUrl: coverUrl.trim() || playlist.coverUrl,
    });

    closeEditPlaylist();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Music className="w-5 h-5 text-spotify-green" />
            <span>Edit Playlist Details</span>
          </h2>
          <button
            onClick={closeEditPlaylist}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
            {/* Cover Preview */}
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0 border border-white/10 relative group">
              <img
                src={coverUrl || playlist.coverUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <ImageIcon className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Inputs */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Playlist Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Playlist"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green focus:bg-white/10 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-spotify-green focus:bg-white/10 transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Give your playlist a catchy description"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green focus:bg-white/10 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={closeEditPlaylist}
              className="px-4 py-2 rounded-full text-xs font-bold text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-full bg-spotify-green hover:bg-spotify-lightGreen text-black text-xs font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
