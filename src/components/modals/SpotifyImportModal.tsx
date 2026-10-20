import React, { useState } from 'react';
import { X, Music2, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useUiStore } from '../../store/uiStore';
import { useLibraryStore } from '../../store/libraryStore';
import { usePlayerStore } from '../../store/playerStore';
import { spotifyImporter, SpotifyImportResult } from '../../services/spotify/spotifyImporter';
import { db } from '../../services/db/database';

export const SpotifyImportModal: React.FC = () => {
  const { isSpotifyImportModalOpen, setSpotifyImportModalOpen, setSelectedPlaylistId } = useUiStore();
  const { playTrack } = usePlayerStore();

  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SpotifyImportResult | null>(null);

  if (!isSpotifyImportModalOpen) return null;

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spotifyUrl.trim()) return;

    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const result = await spotifyImporter.importPlaylistFromUrl(spotifyUrl.trim());
      setPreview(result);
    } catch (err: any) {
      setError(err.message || 'Failed to parse Spotify playlist.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;

    try {
      // 1. Save tracks and playlist into IndexedDB
      await db.tracks.bulkAdd(preview.tracks);
      await db.playlists.add(preview.playlist);

      // 2. Update library store
      useLibraryStore.setState((state) => ({
        tracks: [...preview.tracks, ...state.tracks],
        playlists: [preview.playlist, ...state.playlists],
      }));

      // 3. Trigger celebration
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#1DB954', '#ffffff', '#1ed760'],
      });

      // 4. Close modal and open new playlist
      setSpotifyImportModalOpen(false);
      setSelectedPlaylistId(preview.playlist.id);

      // 5. Start playing the first track
      if (preview.tracks.length > 0) {
        playTrack(preview.tracks[0], preview.tracks);
      }
    } catch (err: any) {
      setError('Error saving playlist to local storage: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-spotify-card border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-spotify-green flex items-center justify-center text-black shadow-lg">
              <Music2 className="w-5 h-5 fill-black stroke-black" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Import Spotify Playlist
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-spotify-green/20 text-spotify-green">
                  Full Length
                </span>
              </h2>
              <p className="text-xs text-spotify-subdued">Transfer your playlists from Spotify directly into Spotibai</p>
            </div>
          </div>

          <button
            onClick={() => {
              setSpotifyImportModalOpen(false);
              setPreview(null);
              setError(null);
            }}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handlePreview} className="space-y-4 mb-4">
          <div>
            <label className="text-xs text-neutral-300 font-semibold block mb-1.5">
              Paste Spotify Playlist Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://open.spotify.com/playlist/..."
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                autoFocus
                className="flex-1 bg-spotify-elevated text-white text-xs px-3.5 py-2.5 rounded-xl border border-white/10 outline-none focus:border-spotify-green transition-colors placeholder-neutral-500"
              />
              <button
                type="submit"
                disabled={loading || !spotifyUrl.trim()}
                className="px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center gap-1.5 flex-shrink-0"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Preview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1.5">
              Example: Open Spotify → Click any playlist → Share → Copy Link to Playlist.
            </p>
          </div>
        </form>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview Card */}
        {preview && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 mb-5 animate-in fade-in duration-200">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0 shadow-md">
                <img
                  src={preview.playlist.coverUrl}
                  alt={preview.playlist.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-spotify-green">
                  Ready to Import
                </span>
                <h3 className="text-base font-bold text-white truncate">
                  {preview.playlist.name}
                </h3>
                <p className="text-xs text-neutral-400 line-clamp-1">
                  {preview.playlist.description}
                </p>
                <div className="text-xs text-neutral-300 font-semibold mt-1 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-spotify-green" />
                  <span>{preview.tracks.length} full-length songs discovered</span>
                </div>
              </div>
            </div>

            {/* First few tracks preview */}
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border-t border-white/5 pt-2">
              {preview.tracks.slice(0, 5).map((track, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 text-neutral-300">
                  <span className="truncate pr-2">{idx + 1}. {track.title} - {track.artist}</span>
                  <span className="text-neutral-500 font-mono text-[10px]">Full Song</span>
                </div>
              ))}
              {preview.tracks.length > 5 && (
                <div className="text-[11px] text-neutral-500 italic pt-1">
                  + {preview.tracks.length - 5} more songs...
                </div>
              )}
            </div>

            <button
              onClick={handleConfirmImport}
              className="w-full py-3 rounded-full bg-spotify-green text-black font-extrabold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-black" />
              <span>Import & Play Now ({preview.tracks.length} Songs)</span>
            </button>
          </div>
        )}

        <div className="text-[11px] text-neutral-500 text-center">
          Tracks are automatically resolved to full-length audio and saved locally in your browser.
        </div>
      </div>
    </div>
  );
};
