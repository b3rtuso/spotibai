import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Heart, 
  Volume2, 
  Volume1, 
  VolumeX, 
  ChevronDown,
  Mic2,
  Music2,
  ListMusic,
  X,
  Sparkles
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useUiStore } from '../../store/uiStore';
import { lyricsService } from '../../services/lyrics/lyricsService';
import { LyricsLine } from '../../types';
import { formatTime } from '../../utils/colorExtractor';
import { KaraokeVocalSlider } from './KaraokeVocalSlider';

export const FullscreenNowPlaying: React.FC = () => {
  const { 
    isFullscreenNowPlaying, 
    toggleFullscreenNowPlaying, 
    isLyricsOpen, 
    toggleLyrics, 
    toggleQueue, 
    ambientColor 
  } = useUiStore();

  const { 
    currentTrack, 
    isPlaying, 
    currentTime, 
    duration, 
    volume, 
    isMuted, 
    shuffle, 
    repeat, 
    isVocalMuted,
    isKaraokeMode,
    vocalLevel,
    toggleKaraokeMode,
    toggleVocalMute,
    setVocalLevel,
    karaokeStatus,
    karaokeStatusText,
    togglePlay, 
    nextTrack, 
    previousTrack, 
    seek, 
    setVolume, 
    toggleMute, 
    toggleShuffle, 
    toggleRepeat 
  } = usePlayerStore();

  const { tracks, toggleLike } = useLibraryStore();

  const [lyrics, setLyrics] = useState<LyricsLine[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileLyricsContainerRef = useRef<HTMLDivElement | null>(null);

  const isVisible = (isFullscreenNowPlaying || isLyricsOpen) && Boolean(currentTrack);

  const handleClose = () => {
    if (isFullscreenNowPlaying) toggleFullscreenNowPlaying();
    if (isLyricsOpen) toggleLyrics();
  };

  const effectiveDuration = duration && duration > 0 ? duration : (currentTrack?.duration || 180);
  const progressPercent = Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100));

  const isTrackLiked = currentTrack
    ? tracks.some((t) => t.id === currentTrack.id && t.isLiked) || Boolean(currentTrack.isLiked)
    : false;

  // Fetch lyrics when track changes or view becomes visible
  useEffect(() => {
    if (!isVisible || !currentTrack) return;
    let isMounted = true;
    setLyricsLoading(true);

    lyricsService.getLyricsForTrack(currentTrack).then((lines) => {
      if (isMounted) {
        setLyrics(lines);
        setLyricsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isVisible, currentTrack?.id]);

  // Determine active lyric line index
  const currentTimeMs = currentTime * 1000;
  let activeLyricIdx = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTimeMs >= lyrics[i].timeMs) {
      activeLyricIdx = i;
      break;
    }
  }

  // Smoothly auto-scroll active lyric to center
  useEffect(() => {
    const activeLine = activeLineRef.current;
    if (!activeLine) return;

    // Desktop container
    const container = lyricsContainerRef.current;
    if (container) {
      const targetScroll = activeLine.offsetTop - container.clientHeight / 2 + activeLine.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }

    // Mobile container
    const mobileContainer = mobileLyricsContainerRef.current;
    if (mobileContainer) {
      const targetScroll = activeLine.offsetTop - mobileContainer.clientHeight / 2 + activeLine.clientHeight / 2;
      mobileContainer.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [activeLyricIdx]);

  if (!isVisible || !currentTrack) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none overflow-hidden h-[100dvh] max-h-[100dvh] animate-in fade-in duration-300 text-white">
      {/* Background Ambient Glow & Blur */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-[120px] opacity-25 pointer-events-none scale-150 transition-all duration-1000"
        style={{ backgroundImage: `url(${currentTrack.artworkUrl})` }}
      />
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at 30% 40%, ${ambientColor} 0%, transparent 70%)`
        }}
      />

      {/* Top Header */}
      <header className="relative z-10 flex-shrink-0 flex items-center justify-between px-4 sm:px-8 py-2.5 sm:py-3.5 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleClose}
            title="Collapse Lyrics (Down)"
            className="p-1.5 -ml-1 sm:ml-0 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-spotify-green/10 border border-spotify-green/20">
            <Mic2 className="w-3.5 h-3.5 text-spotify-green animate-pulse" />
            <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-spotify-green">
              Lyrics
            </span>
          </div>

          {/* Karaoke Mode (Mute Singer / Instruments Only) */}
          <button
            onClick={toggleKaraokeMode}
            title={
              isKaraokeMode
                ? 'Karaoke ON: Singer Muted (Instruments Only) — Click to restore vocals'
                : 'Karaoke Mode: Mute Singer & Play Instruments'
            }
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all text-xs sm:text-sm font-bold shadow-md cursor-pointer ${
              isKaraokeMode
                ? 'bg-spotify-green text-black ring-2 ring-white/20 shadow-[0_0_15px_rgba(29,185,84,0.5)] scale-105'
                : 'bg-white/10 text-neutral-300 hover:text-white hover:bg-white/15'
            }`}
          >
            {isKaraokeMode ? (
              <>
                <Music2 className="w-3.5 h-3.5 text-black" />
                <span>Instruments Only</span>
              </>
            ) : (
              <>
                <Mic2 className="w-3.5 h-3.5 text-spotify-green" />
                <span>Mute Singer</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleQueue}
            title="Play Queue"
            className="p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
          >
            <ListMusic className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={handleClose}
            title="Close Lyrics (Esc)"
            className="p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </header>

      {/* MOBILE VERSION (< lg): Maximizes lyrics height with compact top track card */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:hidden overflow-hidden px-4 pt-2">
        {/* Compact Mobile Track Card */}
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex-shrink-0 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0 shadow-md">
              <img
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white truncate">
                {currentTrack.title}
              </span>
              <span className="text-xs text-neutral-400 font-medium truncate">
                {currentTrack.artist}
              </span>
            </div>
          </div>

          <button
            onClick={() => toggleLike(currentTrack.id, currentTrack)}
            className="p-2 text-neutral-400 hover:text-white transition-colors flex-shrink-0"
            title={isTrackLiked ? 'Unlike' : 'Like'}
          >
            <Heart
              className={`w-5 h-5 transition-transform active:scale-125 ${
                isTrackLiked ? 'fill-spotify-green text-spotify-green' : ''
              }`}
            />
          </button>
        </div>


        {/* Mobile Dedicated Full Lyrics Scrollable Area */}
        <div 
          ref={mobileLyricsContainerRef}
          className="flex-1 min-h-0 overflow-y-auto px-2 py-4 flex flex-col space-y-4 scrollbar-none"
        >
          {lyricsLoading ? (
            <div className="my-auto flex flex-col items-center justify-center gap-2 py-12 text-neutral-400">
              <div className="w-7 h-7 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold">Loading synchronized lyrics...</span>
            </div>
          ) : lyrics.length === 0 ? (
            <div className="my-auto text-neutral-500 flex flex-col items-center justify-center gap-2 py-12">
              <Mic2 className="w-10 h-10 text-neutral-600" />
              <span className="text-base font-bold text-neutral-300">Sing along with Spotibai</span>
              <p className="text-xs text-neutral-500 text-center max-w-xs">
                No synchronized lyrics available for this track. Enjoy the music!
              </p>
            </div>
          ) : (
            lyrics.map((line, idx) => {
              const isActive = idx === activeLyricIdx;
              return (
                <div
                  key={`mobile-${line.timeMs}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seek(line.timeMs / 1000)}
                  className={`cursor-pointer transition-all duration-300 py-1 rounded-lg ${
                    isActive
                      ? 'text-white text-2xl sm:text-3xl font-black scale-[1.02] origin-left flex items-center gap-2'
                      : 'text-neutral-400/80 hover:text-white text-base sm:text-lg font-bold opacity-60 hover:opacity-100'
                  }`}
                >
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-spotify-green shadow-[0_0_8px_#1DB954] flex-shrink-0" />
                  )}
                  {isActive && line.words && line.words.length > 0 ? (
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      {line.words.map((word, wIdx) => {
                        const isWordActive = currentTimeMs >= word.timeMs;
                        return (
                          <span
                            key={wIdx}
                            className={`transition-all duration-150 ${
                              isWordActive
                                ? 'text-white font-black drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] scale-105'
                                : 'text-neutral-400 font-bold opacity-70'
                            }`}
                          >
                            {word.text}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    <span>{line.text}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* DESKTOP VERSION (lg and up): Side-by-side Album Artwork + Expansive Lyrics */}
      <main className="relative z-10 flex-1 min-h-0 hidden lg:flex items-center justify-center gap-12 px-12 xl:px-20 overflow-hidden">
        {/* Left: Artwork & Info */}
        <div className="flex flex-col items-start max-w-sm xl:max-w-md w-full flex-shrink-0">
          <div className="relative aspect-square w-72 h-72 xl:w-96 xl:h-96 rounded-2xl overflow-hidden shadow-2xl mb-4 bg-neutral-900 border border-white/10 group">
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 pr-4">
              <h1 className="text-2xl xl:text-3xl font-black text-white tracking-tight truncate">
                {currentTrack.title}
              </h1>
              <p className="text-base xl:text-lg text-neutral-400 font-semibold truncate mt-1">
                {currentTrack.artist}
              </p>
              <p className="text-xs text-neutral-500 truncate mt-0.5">
                {currentTrack.album || 'Single'}
              </p>
            </div>

            <button
              onClick={() => toggleLike(currentTrack.id, currentTrack)}
              className="p-3 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors flex-shrink-0"
              title={isTrackLiked ? 'Unlike' : 'Like'}
            >
              <Heart
                className={`w-7 h-7 transition-transform active:scale-125 ${
                  isTrackLiked ? 'fill-spotify-green text-spotify-green' : ''
                }`}
              />
            </button>
          </div>

          {/* Desktop Apple Music Sing Karaoke Vocal Slider */}
          <div className="w-full mt-6 pt-4 border-t border-white/10">
            <KaraokeVocalSlider compact={false} />
          </div>
        </div>

        {/* Right: Live Synced Karaoke Lyrics */}
        <div 
          ref={lyricsContainerRef}
          className="flex-1 h-full w-full max-w-2xl overflow-y-auto px-6 py-12 flex flex-col space-y-6 scrollbar-none"
        >
          {lyricsLoading ? (
            <div className="my-auto flex flex-col items-center gap-2 text-neutral-400 w-full py-12">
              <div className="w-8 h-8 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold">Loading synchronized lyrics...</span>
            </div>
          ) : lyrics.length === 0 ? (
            <div className="my-auto text-neutral-500 flex flex-col items-center gap-3 w-full py-12">
              <Mic2 className="w-12 h-12 text-neutral-600" />
              <span className="text-xl font-bold text-neutral-300">Sing along with Spotibai</span>
              <p className="text-xs text-neutral-500 max-w-xs text-center">
                Synchronized lyrics are fetched automatically when available.
              </p>
            </div>
          ) : (
            lyrics.map((line, idx) => {
              const isActive = idx === activeLyricIdx;
              return (
                <div
                  key={`desktop-${line.timeMs}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seek(line.timeMs / 1000)}
                  className={`cursor-pointer transition-all duration-300 py-1 max-w-xl ${
                    isActive
                      ? 'text-white text-3xl xl:text-4xl font-black scale-105 origin-left'
                      : 'text-neutral-500 hover:text-neutral-300 text-xl xl:text-2xl font-bold opacity-60 hover:opacity-100'
                  }`}
                >
                  {isActive && line.words && line.words.length > 0 ? (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {line.words.map((word, wIdx) => {
                        const isWordActive = currentTimeMs >= word.timeMs;
                        return (
                          <span
                            key={wIdx}
                            className={`transition-all duration-150 ${
                              isWordActive
                                ? 'text-white font-black drop-shadow-[0_0_14px_rgba(255,255,255,0.95)]'
                                : 'text-neutral-400 font-bold opacity-70'
                            }`}
                          >
                            {word.text}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    <span>{line.text}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Bottom Transport Controls & Green Volume Bar */}
      <footer className="relative z-10 flex-shrink-0 px-4 sm:px-8 pt-2 pb-4 sm:pb-6 max-w-4xl mx-auto w-full pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/5 backdrop-blur-md">
        {/* Scrubber */}
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <span className="text-[11px] sm:text-xs text-neutral-400 font-medium tabular-nums w-9 sm:w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1 py-2 group">
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden group-hover:h-2 transition-all">
              <div
                className="h-full bg-spotify-green rounded-full transition-[width] duration-150 ease-linear shadow-[0_0_8px_rgba(29,185,84,0.4)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={effectiveDuration}
              step={0.1}
              value={Math.min(currentTime, effectiveDuration)}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label="Seek track"
            />
          </div>
          <span className="text-[11px] sm:text-xs text-neutral-400 font-medium tabular-nums w-9 sm:w-10">
            {formatTime(effectiveDuration)}
          </span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          {/* Left: Shuffle */}
          <div className="flex items-center gap-2 sm:gap-4 w-1/4">
            <button
              onClick={toggleShuffle}
              title={shuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
              className={`p-1.5 sm:p-2 transition-colors ${
                shuffle ? 'text-spotify-green' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Shuffle className="w-5 h-5" />
            </button>
          </div>

          {/* Center: Prev, Play/Pause, Next */}
          <div className="flex items-center gap-4 sm:gap-6 justify-center flex-1">
            <button
              onClick={previousTrack}
              title="Previous Track"
              className="p-1.5 sm:p-2 text-neutral-300 hover:text-white transition-colors active:scale-95"
            >
              <SkipBack className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-2xl"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-black stroke-black" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-black stroke-black ml-0.5" />
              )}
            </button>

            <button
              onClick={nextTrack}
              title="Next Track"
              className="p-1.5 sm:p-2 text-neutral-300 hover:text-white transition-colors active:scale-95"
            >
              <SkipForward className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
            </button>
          </div>

          {/* Right: Repeat Toggle + Desktop Green Volume */}
          <div className="flex items-center justify-end gap-3 sm:gap-4 w-1/4">
            <button
              onClick={toggleRepeat}
              title={`Repeat: ${repeat}`}
              className={`p-1.5 sm:p-2 transition-colors ${
                repeat !== 'off' ? 'text-spotify-green' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>

            {/* Desktop Green Volume Level Slider */}
            <div className="hidden lg:flex items-center gap-2">
              <button 
                onClick={toggleMute} 
                className="text-neutral-400 hover:text-white p-1"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5 text-spotify-green" />
                ) : (
                  <Volume2 className="w-5 h-5 text-spotify-green" />
                )}
              </button>

              <div className="relative w-24 flex items-center py-2">
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-spotify-green rounded-full shadow-[0_0_8px_rgba(29,185,84,0.6)] transition-all"
                    style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  aria-label="Volume level"
                />
              </div>

              <span className="text-xs font-bold text-spotify-green tabular-nums w-8 text-right">
                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* MOBILE GREEN VOLUME BAR: Dedicated, clearly visible green volume level on mobile phones */}
        <div className="lg:hidden flex items-center gap-2.5 mt-3 pt-2 border-t border-white/5">
          <button 
            onClick={toggleMute} 
            className="p-1 text-neutral-400 hover:text-white flex-shrink-0"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-spotify-green" />
            )}
          </button>

          <div className="relative flex-1 flex items-center h-5">
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-spotify-green rounded-full shadow-[0_0_8px_rgba(29,185,84,0.6)] transition-all"
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label="Mobile volume level"
            />
          </div>

          <span className="text-[11px] font-bold text-spotify-green tabular-nums w-8 text-right flex-shrink-0">
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </footer>
    </div>
  );
};
