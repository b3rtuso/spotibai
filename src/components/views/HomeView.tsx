import React from 'react';
import { Play, Heart, ArrowDownCircle, FolderOpen, Sparkles } from 'lucide-react';
import { useLibraryStore } from '../../store/libraryStore';
import { usePlayerStore } from '../../store/playerStore';
import { useUiStore } from '../../store/uiStore';
import { TrackCard } from '../common/TrackCard';

export const HomeView: React.FC = () => {
  const { tracks, playlists } = useLibraryStore();
  const { playTrack } = usePlayerStore();
  const { setActiveView, setSelectedPlaylistId, isOfflineMode } = useUiStore();

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const downloadedTracks = tracks.filter((t) => t.isDownloaded);
  const localTracks = tracks.filter((t) => t.sourceType === 'local');
  const synthwaveTracks = tracks.filter((t) => t.genre === 'Synthwave' || t.genre === 'Ambient Electronic' || t.genre === 'Tech House');
  const chillTracks = tracks.filter((t) => t.genre === 'Lo-Fi Chill' || t.genre === 'Lo-Fi Hip-Hop' || t.genre === 'Acoustic Folk');

  return (
    <div className="p-4 sm:p-6 md:p-8 pb-32 space-y-6 sm:space-y-8 select-none">
      {/* Offline Mode Banner if active */}
      {isOfflineMode && (
        <div className="p-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-400">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Offline Mode Active: Showing downloaded and locally stored music.</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">No Data Usage</span>
        </div>
      )}

      {/* Greeting Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          {getGreeting()}
        </h1>
      </div>

      {/* 6 Quick-Access Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {/* Liked Songs Card */}
        <div
          onClick={() => setActiveView('liked')}
          className="group relative flex items-center bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden cursor-pointer transition-colors shadow-sm"
        >
          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-700 via-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 text-white">
            <Heart className="w-6 h-6 sm:w-8 sm:h-8 fill-white" />
          </div>
          <div className="flex-1 px-2.5 sm:px-4 font-bold text-xs sm:text-sm text-white truncate">
            Liked Songs
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-spotify-green text-black hidden sm:flex items-center justify-center mr-3 opacity-0 group-hover:opacity-100 shadow-xl transition-all group-hover:scale-105">
            <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
          </div>
        </div>

        {/* Downloaded Offline Card */}
        <div
          onClick={() => setActiveView('downloaded')}
          className="group relative flex items-center bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden cursor-pointer transition-colors shadow-sm"
        >
          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-800 to-teal-600 flex items-center justify-center flex-shrink-0 text-white">
            <ArrowDownCircle className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div className="flex-1 px-2.5 sm:px-4 font-bold text-xs sm:text-sm text-white truncate">
            Downloaded Offline
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-spotify-green text-black hidden sm:flex items-center justify-center mr-3 opacity-0 group-hover:opacity-100 shadow-xl transition-all group-hover:scale-105">
            <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
          </div>
        </div>

        {/* Local Files Card */}
        <div
          onClick={() => setActiveView('local')}
          className="group relative flex items-center bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden cursor-pointer transition-colors shadow-sm"
        >
          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-800 to-cyan-700 flex items-center justify-center flex-shrink-0 text-white">
            <FolderOpen className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div className="flex-1 px-2.5 sm:px-4 font-bold text-xs sm:text-sm text-white truncate">
            Your Local Files
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-spotify-green text-black hidden sm:flex items-center justify-center mr-3 opacity-0 group-hover:opacity-100 shadow-xl transition-all group-hover:scale-105">
            <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
          </div>
        </div>

        {/* Curated Playlists in quick grid */}
        {playlists.slice(0, 3).map((pl) => (
          <div
            key={pl.id}
            onClick={() => setSelectedPlaylistId(pl.id)}
            className="group relative flex items-center bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden cursor-pointer transition-colors shadow-sm"
          >
            <div className="w-14 h-14 sm:w-20 sm:h-20 flex-shrink-0 bg-neutral-800">
              <img src={pl.coverUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 px-2.5 sm:px-4 font-bold text-xs sm:text-sm text-white truncate">
              {pl.name}
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-spotify-green text-black hidden sm:flex items-center justify-center mr-3 opacity-0 group-hover:opacity-100 shadow-xl transition-all group-hover:scale-105">
              <Play className="w-4 h-4 fill-black stroke-black ml-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Shelf: Made For You */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-spotify-green" />
            <h2 className="text-xl font-bold text-white hover:underline cursor-pointer">
              Made For You
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {tracks.slice(0, 6).map((track) => (
            <TrackCard key={track.id} track={track} allTracks={tracks} />
          ))}
        </div>
      </section>

      {/* Shelf: Synthwave & Cyberpunk Beats */}
      {synthwaveTracks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white hover:underline cursor-pointer">
              Electronic & Synthwave Nights
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {synthwaveTracks.map((track) => (
              <TrackCard key={track.id} track={track} allTracks={synthwaveTracks} />
            ))}
          </div>
        </section>
      )}

      {/* Shelf: Chill & Lo-Fi Lounge */}
      {chillTracks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white hover:underline cursor-pointer">
              Chill & Lo-Fi Study Beats
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {chillTracks.map((track) => (
              <TrackCard key={track.id} track={track} allTracks={chillTracks} />
            ))}
          </div>
        </section>
      )}

      {/* Shelf: Downloaded Offline */}
      {downloadedTracks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-spotify-green">✓</span>
              Ready For Offline Listening ({downloadedTracks.length})
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {downloadedTracks.map((track) => (
              <TrackCard key={track.id} track={track} allTracks={downloadedTracks} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
