import React, { useEffect, useState } from 'react';
import { Play, Pause, Check, Heart, UserPlus, Disc, Music, Sparkles, CheckCircle2 } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { usePlayerStore } from '../../store/playerStore';
import { onlineSearchService } from '../../services/api/onlineSearchService';
import { Artist, Album, Track } from '../../types';
import { TrackRow } from '../common/TrackRow';

export const ArtistView: React.FC = () => {
  const {
    selectedArtistName,
    selectedArtistId,
    setSelectedAlbum,
    followedArtists,
    toggleFollowArtist,
    setAmbientColor,
  } = useUiStore();

  const { playTrack, togglePlay, isPlaying, currentTrack } = usePlayerStore();

  const [artist, setArtist] = useState<Artist | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [discographyFilter, setDiscographyFilter] = useState<'all' | 'albums' | 'singles'>('all');

  useEffect(() => {
    if (!selectedArtistName && !selectedArtistId) return;

    let isMounted = true;
    setIsLoading(true);

    onlineSearchService
      .getArtistDetails(selectedArtistId || selectedArtistName || '')
      .then((data) => {
        if (!isMounted) return;
        setArtist(data.artist);
        setTopTracks(data.topTracks);
        setAlbums(data.albums);
        setIsLoading(false);
        // Set dynamic ambient color
        setAmbientColor('rgb(45, 55, 75)');
      })
      .catch((err) => {
        console.error('Failed to load artist details:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedArtistName, selectedArtistId]);

  const isFollowed = artist ? followedArtists.includes(artist.name) : false;

  const isArtistPlaying =
    isPlaying &&
    currentTrack &&
    artist &&
    currentTrack.artist.toLowerCase().includes(artist.name.toLowerCase());

  const handlePlayArtist = () => {
    if (isArtistPlaying) {
      togglePlay();
    } else if (topTracks.length > 0) {
      playTrack(topTracks[0], topTracks);
    }
  };

  const filteredAlbums = albums.filter((alb) => {
    if (discographyFilter === 'albums') return (alb.trackCount || 0) > 3;
    if (discographyFilter === 'singles') return (alb.trackCount || 0) <= 3;
    return true;
  });

  const visibleTracks = showAllTracks ? topTracks : topTracks.slice(0, 5);

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6 animate-pulse">
        <div className="h-64 sm:h-80 bg-neutral-800/60 rounded-3xl" />
        <div className="h-10 w-48 bg-neutral-800 rounded-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-neutral-800/40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="p-12 text-center text-neutral-400">
        <Music className="w-12 h-12 mx-auto mb-3 opacity-40 text-spotify-green" />
        <h2 className="text-xl font-bold text-white mb-1">Artist Not Found</h2>
        <p className="text-xs text-neutral-500">
          We couldn't retrieve details for this artist. Please try searching again.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pb-36 select-none animate-in fade-in duration-300">
      {/* Immersive Artist Hero Banner */}
      <div className="relative h-72 sm:h-96 w-full overflow-hidden flex flex-col justify-end p-6 md:p-10">
        {/* Background photo & dark Spotify gradient */}
        <div
          className="absolute inset-0 bg-cover bg-center scale-105 filter blur-[0.5px] brightness-75"
          style={{ backgroundImage: `url(${artist.avatarUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-spotify-black via-spotify-black/60 to-black/40" />

        {/* Artist Header Info */}
        <div className="relative z-10 space-y-2 md:space-y-3 max-w-4xl">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30 backdrop-blur-md">
              <CheckCircle2 className="w-3.5 h-3.5 fill-blue-400 text-black" />
              <span>Verified Artist</span>
            </span>
            <span className="text-xs text-neutral-300 font-semibold uppercase tracking-wider">
              {artist.genre}
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-none drop-shadow-xl">
            {artist.name}
          </h1>

          <p className="text-xs sm:text-sm text-neutral-200 font-semibold drop-shadow">
            {artist.monthlyListeners ? artist.monthlyListeners.toLocaleString() : '1,200,000'} monthly listeners
          </p>
        </div>
      </div>

      {/* Action Controls Bar */}
      <div className="px-6 md:px-10 py-5 flex items-center gap-4 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
        {/* Big Spotify Play Button */}
        <button
          onClick={handlePlayArtist}
          title={isArtistPlaying ? 'Pause' : `Play ${artist.name}`}
          className="w-14 h-14 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          {isArtistPlaying ? (
            <Pause className="w-6 h-6 fill-black stroke-black" />
          ) : (
            <Play className="w-6 h-6 fill-black stroke-black ml-1" />
          )}
        </button>

        {/* Follow / Following Toggle Button */}
        <button
          onClick={() => toggleFollowArtist(artist.name)}
          className={`px-5 py-2 rounded-full text-xs font-bold tracking-wider uppercase border transition-all ${
            isFollowed
              ? 'bg-spotify-green/20 text-spotify-green border-spotify-green hover:bg-spotify-green/30'
              : 'border-white/30 text-white hover:border-white hover:scale-105 bg-white/5'
          }`}
        >
          {isFollowed ? 'Following' : 'Follow'}
        </button>
      </div>

      <div className="px-6 md:px-10 space-y-10 mt-6">
        {/* Popular Songs Section */}
        {topTracks.length > 0 && (
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-4">Popular</h2>
            <div className="space-y-0.5">
              {visibleTracks.map((track, idx) => (
                <TrackRow
                  key={`${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  playlistContext={topTracks}
                />
              ))}
            </div>

            {topTracks.length > 5 && (
              <button
                onClick={() => setShowAllTracks((prev) => !prev)}
                className="mt-4 text-xs font-bold text-neutral-400 hover:text-white uppercase tracking-wider transition-colors"
              >
                {showAllTracks ? 'Show less' : 'See more'}
              </button>
            )}
          </div>
        )}

        {/* Discography / Albums Section */}
        {albums.length > 0 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-black text-white tracking-tight">Discography</h2>
              {/* Discography filter chips */}
              <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-full border border-white/5">
                {(['all', 'albums', 'singles'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDiscographyFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all ${
                      discographyFilter === filter
                        ? 'bg-white text-black shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'albums' ? 'Albums' : 'Singles & EPs'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredAlbums.map((album) => (
                <div
                  key={album.id}
                  onClick={() => setSelectedAlbum(album.id)}
                  className="group p-3.5 bg-spotify-card hover:bg-spotify-cardHover rounded-2xl cursor-pointer transition-all duration-300 shadow-md relative"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-neutral-800 shadow-lg">
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Hover Play Button */}
                    <div className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
                      <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white truncate mb-1" title={album.title}>
                    {album.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-semibold truncate">
                    <span>{album.releaseYear || 'Album'}</span>
                    <span>•</span>
                    <span className="capitalize">{album.trackCount ? `${album.trackCount} songs` : 'Album'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* About Artist Card */}
        <div className="max-w-3xl">
          <h2 className="text-2xl font-black text-white tracking-tight mb-4">About</h2>
          <div
            className="relative rounded-3xl overflow-hidden p-6 sm:p-8 bg-neutral-900/90 border border-white/5 flex flex-col md:flex-row items-center gap-6 shadow-xl"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.6)), url(${artist.avatarUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl flex-shrink-0">
              <img src={artist.avatarUrl} alt={artist.name} className="w-full h-full object-cover" />
            </div>

            <div className="space-y-2 text-center md:text-left">
              <div className="text-xl sm:text-2xl font-black text-white">{artist.name}</div>
              <div className="text-sm font-bold text-spotify-green">
                {artist.followers ? artist.followers.toLocaleString() : '540,000'} followers
              </div>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-medium">
                {artist.bio}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
