import React, { useEffect, useState } from 'react';
import { Play, Pause, Disc, Clock, Calendar, ArrowLeft } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { usePlayerStore } from '../../store/playerStore';
import { onlineSearchService } from '../../services/api/onlineSearchService';
import { Album, Track } from '../../types';
import { TrackRow } from '../common/TrackRow';

export const AlbumView: React.FC = () => {
  const { selectedAlbumId, setSelectedArtist, goBack, setAmbientColor } = useUiStore();
  const { playTrack, togglePlay, isPlaying, currentTrack } = usePlayerStore();

  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedAlbumId) return;

    let isMounted = true;
    setIsLoading(true);

    onlineSearchService
      .getAlbumDetails(selectedAlbumId)
      .then((data) => {
        if (!isMounted) return;
        setAlbum(data.album);
        setTracks(data.tracks);
        setIsLoading(false);
        setAmbientColor('rgb(55, 45, 65)');
      })
      .catch((err) => {
        console.error('Failed to load album details:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedAlbumId]);

  const isAlbumPlaying =
    isPlaying &&
    currentTrack &&
    album &&
    (currentTrack.album.toLowerCase() === album.title.toLowerCase() ||
      tracks.some((t) => t.id === currentTrack.id));

  const handlePlayAlbum = () => {
    if (isAlbumPlaying) {
      togglePlay();
    } else if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const totalDurationSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMinutes = Math.floor(totalDurationSeconds / 60);

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6 animate-pulse">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 h-64 bg-neutral-800/40 rounded-3xl p-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 bg-neutral-800/30 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="p-12 text-center text-neutral-400">
        <Disc className="w-12 h-12 mx-auto mb-3 opacity-40 text-spotify-green" />
        <h2 className="text-xl font-bold text-white mb-1">Album Not Found</h2>
        <p className="text-xs text-neutral-500">
          We couldn't retrieve details for this album. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 pb-36 space-y-6 select-none animate-in fade-in duration-300">
      {/* Back button */}
      <button
        onClick={goBack}
        className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Album Header Banner */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 bg-gradient-to-b from-white/10 to-transparent p-6 rounded-3xl border border-white/5 shadow-2xl">
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl bg-neutral-800 flex-shrink-0 border border-white/10">
          <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
        </div>

        <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
          <span className="text-xs font-extrabold uppercase tracking-widest text-spotify-green">
            Album
          </span>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight truncate">
            {album.title}
          </h1>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm text-neutral-300 font-semibold">
            <span
              onClick={() => setSelectedArtist(album.artist, album.artistId)}
              className="text-white hover:underline cursor-pointer font-bold"
            >
              {album.artist}
            </span>
            {album.releaseYear && (
              <>
                <span>•</span>
                <span>{album.releaseYear}</span>
              </>
            )}
            <span>•</span>
            <span>{tracks.length} songs</span>
            {totalMinutes > 0 && (
              <>
                <span>•</span>
                <span>about {totalMinutes} min</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-4 py-2">
        <button
          onClick={handlePlayAlbum}
          title={isAlbumPlaying ? 'Pause album' : 'Play album'}
          className="w-14 h-14 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          {isAlbumPlaying ? (
            <Pause className="w-6 h-6 fill-black stroke-black" />
          ) : (
            <Play className="w-6 h-6 fill-black stroke-black ml-1" />
          )}
        </button>
      </div>

      {/* Album Tracks List */}
      <div className="space-y-0.5">
        <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-white/10 text-xs font-bold text-neutral-400 uppercase tracking-wider">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-7 sm:col-span-6">Title</div>
          <div className="hidden sm:block sm:col-span-3">Plays</div>
          <div className="col-span-4 sm:col-span-2 text-right flex items-center justify-end pr-2">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {tracks.map((track, idx) => (
          <TrackRow
            key={`${track.id}-${idx}`}
            track={track}
            index={idx}
            playlistContext={tracks}
          />
        ))}
      </div>
    </div>
  );
};
