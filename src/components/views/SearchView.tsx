import React, { useEffect, useState } from 'react';
import {
  Search as SearchIcon,
  X,
  Play,
  Globe,
  Sparkles,
  PlusCircle,
  Clock,
  Disc,
  User,
  Music,
  CheckCircle2,
} from 'lucide-react';
import { useLibraryStore } from '../../store/libraryStore';
import { usePlayerStore } from '../../store/playerStore';
import { useUiStore } from '../../store/uiStore';
import { TrackRow } from '../common/TrackRow';
import { onlineSearchService } from '../../services/api/onlineSearchService';
import { Track, Artist, Album } from '../../types';

const RECENT_SEARCHES_KEY = 'spotibai_recent_searches_v1';

const BROWSE_CATEGORIES = [
  { name: 'Pop', color: 'from-pink-600 to-rose-700' },
  { name: 'Hip-Hop', color: 'from-amber-600 to-orange-700' },
  { name: 'Rock', color: 'from-red-600 to-red-800' },
  { name: 'Lo-Fi Chill', color: 'from-teal-600 to-emerald-800' },
  { name: 'Synthwave', color: 'from-purple-600 to-indigo-800' },
  { name: 'Electronic', color: 'from-cyan-600 to-blue-700' },
  { name: 'Acoustic Folk', color: 'from-amber-700 to-yellow-800' },
  { name: 'Ambient Electronic', color: 'from-violet-800 to-purple-900' },
  { name: 'Tech House', color: 'from-fuchsia-600 to-pink-800' },
  { name: 'Study & Focus', color: 'from-blue-700 to-indigo-900' },
];

type SearchTab = 'all' | 'songs' | 'artists' | 'albums';

export const SearchView: React.FC = () => {
  const { tracks, searchQuery, setSearchQuery } = useLibraryStore();
  const { playTrack } = usePlayerStore();
  const { setSelectedArtist, setSelectedAlbum } = useUiStore();

  const [searchTab, setSearchTab] = useState<SearchTab>('all');
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const [albumResults, setAlbumResults] = useState<Album[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const [showAddUrlModal, setShowAddUrlModal] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, 10);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const removeRecentSearch = (item: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((s) => s !== item);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  // 1. Local filtered tracks
  const localFiltered = searchQuery.trim()
    ? tracks.filter((t) => {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          (t.genre && t.genre.toLowerCase().includes(q))
        );
      })
    : [];

  // 2. Debounced Global Multi-Entity Search (Artists, Songs, Albums)
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setOnlineResults([]);
      setArtistResults([]);
      setAlbumResults([]);
      setIsSearchingOnline(false);
      return;
    }

    saveRecentSearch(searchQuery);
    setIsSearchingOnline(true);
    const timer = setTimeout(async () => {
      try {
        const res = await onlineSearchService.searchAll(searchQuery);
        setArtistResults(res.artists);
        setOnlineResults(res.tracks);
        setAlbumResults(res.albums);
      } catch (err) {
        console.warn('Search all failed:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Determine top result: artist match takes precedence if query strongly matches artist name
  const topArtistMatch = artistResults.find((a) =>
    a.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const primaryArtist = topArtistMatch || artistResults[0];
  const primaryTrack = localFiltered[0] || onlineResults[0];

  const handleAddCustomSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim() || !customTitle.trim()) return;

    const newTrack: Track = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim(),
      artist: customArtist.trim() || 'Custom Artist',
      album: 'Web Stream',
      duration: 180,
      audioUrl: customUrl.trim(),
      artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
      sourceType: 'online',
      dateAdded: Date.now(),
    };

    useLibraryStore.setState((state) => ({
      tracks: [newTrack, ...state.tracks],
    }));

    setShowAddUrlModal(false);
    setCustomUrl('');
    setCustomTitle('');
    setCustomArtist('');
    playTrack(newTrack);
  };

  const allTracks = [...localFiltered, ...onlineResults];

  return (
    <div className="p-4 sm:p-6 md:p-8 pb-32 space-y-6 select-none">
      {/* Top Search & Add Link Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="relative w-full sm:flex-1 sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
            <SearchIcon className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Search artists, songs, or albums..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full pl-11 pr-10 py-3 rounded-full bg-spotify-elevated hover:bg-neutral-800 focus:bg-neutral-800 text-white text-sm font-medium outline-none border border-transparent focus:border-white/30 transition-all placeholder-neutral-400 shadow-md"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Add custom URL button */}
        <button
          onClick={() => setShowAddUrlModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 hover:border-white/20 transition-all"
        >
          <PlusCircle className="w-4 h-4 text-spotify-green" />
          <span>Add Custom Audio URL</span>
        </button>
      </div>

      {/* Filter Tabs when query is active */}
      {searchQuery.trim().length >= 2 && (
        <div className="flex items-center gap-2 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
          {(['all', 'songs', 'artists', 'albums'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSearchTab(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                searchTab === tab
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab === 'all'
                ? 'All'
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}

          {isSearchingOnline && (
            <div className="w-3.5 h-3.5 border-2 border-spotify-green border-t-transparent rounded-full animate-spin ml-2 flex-shrink-0" />
          )}
        </div>
      )}

      {/* Add Custom Audio URL Modal */}
      {showAddUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form
            onSubmit={handleAddCustomSong}
            className="bg-spotify-card border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Add Song from Direct Audio URL</h3>
              <button
                type="button"
                onClick={() => setShowAddUrlModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Direct Audio Stream / MP3 URL</label>
              <input
                type="url"
                required
                placeholder="https://example.com/audio.mp3"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full bg-spotify-elevated text-white text-xs p-2.5 rounded-lg border border-white/10 outline-none focus:border-spotify-green"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Song Title</label>
              <input
                type="text"
                required
                placeholder="Title..."
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-spotify-elevated text-white text-xs p-2.5 rounded-lg border border-white/10 outline-none focus:border-spotify-green"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Artist Name</label>
              <input
                type="text"
                placeholder="Artist name..."
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                className="w-full bg-spotify-elevated text-white text-xs p-2.5 rounded-lg border border-white/10 outline-none focus:border-spotify-green"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddUrlModal(false)}
                className="text-xs text-neutral-400 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs bg-spotify-green text-black font-bold px-4 py-2 rounded-full hover:scale-105 transition-transform"
              >
                Add & Play Song
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Results Display */}
      {searchQuery.trim() ? (
        <div className="space-y-10 animate-in fade-in duration-200">
          {/* TAB: ALL */}
          {searchTab === 'all' && (
            <>
              {/* Top Result + Songs Split View */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Top Result Card */}
                <div className="lg:col-span-2">
                  <h2 className="text-xl font-bold text-white mb-3">Top result</h2>

                  {primaryArtist &&
                  searchQuery.trim().length >= 2 &&
                  (topArtistMatch || !primaryTrack) ? (
                    // Top Result is an Artist
                    <div
                      onClick={() => setSelectedArtist(primaryArtist.name, primaryArtist.id)}
                      className="group relative p-6 bg-spotify-card hover:bg-spotify-cardHover rounded-2xl cursor-pointer transition-all duration-300 shadow-md flex flex-col justify-between h-64 border border-white/5"
                    >
                      <div className="w-28 h-28 rounded-full overflow-hidden shadow-2xl bg-neutral-800 border-2 border-white/10">
                        <img
                          src={primaryArtist.avatarUrl}
                          alt={primaryArtist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-2xl font-black text-white truncate">
                            {primaryArtist.name}
                          </span>
                          <CheckCircle2 className="w-4 h-4 fill-blue-400 text-black flex-shrink-0" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider">
                            Artist
                          </span>
                          <span className="text-xs text-neutral-400">
                            {primaryArtist.monthlyListeners
                              ? `${primaryArtist.monthlyListeners.toLocaleString()} monthly listeners`
                              : primaryArtist.genre}
                          </span>
                        </div>
                      </div>

                      <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
                        <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
                      </div>
                    </div>
                  ) : primaryTrack ? (
                    // Top Result is a Song
                    <div
                      onClick={() => playTrack(primaryTrack, allTracks)}
                      className="group relative p-6 bg-spotify-card hover:bg-spotify-cardHover rounded-2xl cursor-pointer transition-all duration-300 shadow-md flex flex-col justify-between h-64 border border-white/5"
                    >
                      <div className="w-24 h-24 rounded-xl overflow-hidden shadow-xl bg-neutral-800">
                        <img
                          src={primaryTrack.artworkUrl}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>

                      <div>
                        <h3 className="text-2xl font-black text-white truncate mb-1">
                          {primaryTrack.title}
                        </h3>
                        <p className="text-sm text-spotify-subtext font-semibold truncate">
                          Song •{' '}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedArtist(primaryTrack.artist);
                            }}
                            className="text-white hover:underline cursor-pointer"
                          >
                            {primaryTrack.artist}
                          </span>
                        </p>
                      </div>

                      <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
                        <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-neutral-500 bg-spotify-card rounded-2xl">
                      No exact match found
                    </div>
                  )}
                </div>

                {/* Songs Section */}
                <div className="lg:col-span-3">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-white">Songs</h2>
                    {allTracks.length > 4 && (
                      <button
                        onClick={() => setSearchTab('songs')}
                        className="text-xs font-bold text-neutral-400 hover:text-white transition-colors"
                      >
                        See all
                      </button>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {allTracks.slice(0, 4).map((track, idx) => (
                      <TrackRow
                        key={`${track.id}-${idx}`}
                        track={track}
                        index={idx}
                        playlistContext={allTracks}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Artists Section */}
              {artistResults.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-black text-white tracking-tight">Artists</h2>
                    {artistResults.length > 5 && (
                      <button
                        onClick={() => setSearchTab('artists')}
                        className="text-xs font-bold text-neutral-400 hover:text-white transition-colors"
                      >
                        Show all
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {artistResults.slice(0, 6).map((artist) => (
                      <div
                        key={artist.id}
                        onClick={() => setSelectedArtist(artist.name, artist.id)}
                        className="group p-4 bg-spotify-card hover:bg-spotify-cardHover rounded-2xl cursor-pointer transition-all duration-300 shadow-md relative text-center"
                      >
                        <div className="relative aspect-square rounded-full overflow-hidden mb-3 bg-neutral-800 shadow-xl mx-auto w-full max-w-[140px] border border-white/5">
                          <img
                            src={artist.avatarUrl}
                            alt={artist.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
                            <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-white truncate" title={artist.name}>
                          {artist.name}
                        </h3>
                        <p className="text-xs text-neutral-400 font-medium capitalize mt-0.5">
                          Artist
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Albums Section */}
              {albumResults.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-black text-white tracking-tight">Albums</h2>
                    {albumResults.length > 6 && (
                      <button
                        onClick={() => setSearchTab('albums')}
                        className="text-xs font-bold text-neutral-400 hover:text-white transition-colors"
                      >
                        Show all
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {albumResults.slice(0, 6).map((album) => (
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
                          <div className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
                            <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-white truncate mb-0.5" title={album.title}>
                          {album.title}
                        </h3>

                        <p className="text-xs text-neutral-400 truncate">
                          {album.releaseYear || ''} •{' '}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedArtist(album.artist, album.artistId);
                            }}
                            className="hover:underline text-neutral-300 font-semibold"
                          >
                            {album.artist}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB: ARTISTS */}
          {searchTab === 'artists' && (
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-4">
                Artists matching "{searchQuery}"
              </h2>

              {artistResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {artistResults.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => setSelectedArtist(artist.name, artist.id)}
                      className="group p-4 bg-spotify-card hover:bg-spotify-cardHover rounded-2xl cursor-pointer transition-all duration-300 shadow-md relative text-center"
                    >
                      <div className="relative aspect-square rounded-full overflow-hidden mb-3 bg-neutral-800 shadow-xl mx-auto w-full max-w-[150px] border border-white/5">
                        <img
                          src={artist.avatarUrl}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
                          <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-white truncate" title={artist.name}>
                        {artist.name}
                      </h3>
                      <p className="text-xs text-neutral-400 font-medium capitalize mt-0.5">
                        Artist
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-500">No artists found for this query.</div>
              )}
            </div>
          )}

          {/* TAB: SONGS */}
          {searchTab === 'songs' && (
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-4">
                Songs matching "{searchQuery}" ({allTracks.length})
              </h2>

              {allTracks.length > 0 ? (
                <div className="space-y-0.5">
                  {allTracks.map((track, idx) => (
                    <TrackRow
                      key={`${track.id}-${idx}`}
                      track={track}
                      index={idx}
                      playlistContext={allTracks}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-500">No songs found for this query.</div>
              )}
            </div>
          )}

          {/* TAB: ALBUMS */}
          {searchTab === 'albums' && (
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-4">
                Albums matching "{searchQuery}" ({albumResults.length})
              </h2>

              {albumResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {albumResults.map((album) => (
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
                        <div className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all">
                          <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-white truncate mb-0.5" title={album.title}>
                        {album.title}
                      </h3>

                      <p className="text-xs text-neutral-400 truncate">
                        {album.releaseYear || ''} •{' '}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArtist(album.artist, album.artistId);
                          }}
                          className="hover:underline text-neutral-300 font-semibold"
                        >
                          {album.artist}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-500">No albums found for this query.</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Recent Searches (Spotify-style) */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-spotify-green" />
                  <span>Recent searches</span>
                </h2>
                <button
                  onClick={clearAllRecentSearches}
                  className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
                >
                  Clear all
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item) => (
                  <div
                    key={item}
                    className="group flex items-center gap-2 bg-neutral-800/80 hover:bg-neutral-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full border border-white/5 hover:border-white/20 transition-all cursor-pointer shadow-sm"
                  >
                    <span onClick={() => setSearchQuery(item)}>{item}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(item);
                      }}
                      className="text-neutral-400 hover:text-white p-0.5 rounded-full hover:bg-white/10"
                      title="Remove from history"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Browse Categories Grid */}
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-4">
              Browse All Categories
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {BROWSE_CATEGORIES.map((cat) => (
                <div
                  key={cat.name}
                  onClick={() => setSearchQuery(cat.name)}
                  className={`relative aspect-square rounded-2xl p-4 overflow-hidden cursor-pointer bg-gradient-to-br ${cat.color} hover:scale-[1.03] transition-transform duration-200 shadow-md group`}
                >
                  <span className="text-lg md:text-xl font-black text-white leading-tight">
                    {cat.name}
                  </span>

                  <div className="absolute -bottom-2 -right-2 w-20 h-20 rounded-lg bg-black/20 transform rotate-25 shadow-lg group-hover:rotate-12 transition-transform" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
