import React, { useState } from 'react';
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
  Mic2,
  Music2,
  ListMusic,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  CheckCircle2,
  DownloadCloud,
  Sparkles
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useUiStore } from '../../store/uiStore';
import { formatTime } from '../../utils/colorExtractor';
import { KaraokeVocalSlider } from './KaraokeVocalSlider';

export const PlayerBar: React.FC = () => {
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
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
  } = usePlayerStore();

  const { tracks, toggleLike, downloadTrack, downloadProgress } = useLibraryStore();
  const {
    isLyricsOpen,
    toggleLyrics,
    isEqualizerOpen,
    toggleEqualizer,
    isQueueOpen,
    toggleQueue,
    isFullscreen,
    toggleFullscreen,
    isFullscreenNowPlaying,
    toggleFullscreenNowPlaying,
    toggleMiniPlayer,
  } = useUiStore();

  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPos, setHoverSeekPos] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubTime, setScrubTime] = useState<number>(0);

  const safeCurrentTime = Number.isFinite(currentTime) && !isNaN(currentTime) && currentTime >= 0
    ? currentTime
    : 0;
  const safeDuration = Number.isFinite(duration) && !isNaN(duration) && duration > 0
    ? duration
    : (currentTrack?.duration && Number.isFinite(currentTrack.duration) && currentTrack.duration > 0
      ? currentTrack.duration
      : 180);

  const displayTime = isScrubbing ? scrubTime : safeCurrentTime;
  const progressPercent = safeDuration > 0
    ? Math.min(100, Math.max(0, (displayTime / safeDuration) * 100))
    : 0;
  const isDownloading = currentTrack ? !!downloadProgress[currentTrack.id] : false;
  const libTrack = currentTrack ? tracks.find((t) => t.id === currentTrack.id) : undefined;
  const isTrackLiked = libTrack !== undefined ? Boolean(libTrack.isLiked) : Boolean(currentTrack?.isLiked);
  const isTrackDownloaded = Boolean(currentTrack?.isDownloaded || (libTrack && libTrack.isDownloaded));


  const handleSeekStart = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    setIsScrubbing(true);
    const val = parseFloat((e.currentTarget as HTMLInputElement).value);
    setScrubTime(Number.isFinite(val) ? val : safeCurrentTime);
  };

  const handleSeekInput = (e: React.FormEvent<HTMLInputElement>) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isFinite(val)) {
      setScrubTime(val);
    }
  };

  const handleSeekCommit = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    const targetTime = Number.isFinite(val) ? val : scrubTime;
    if (Number.isFinite(targetTime)) {
      seek(targetTime);
    }
    setIsScrubbing(false);
  };

  React.useEffect(() => {
    if (!isScrubbing) return;
    const handleGlobalRelease = () => {
      seek(scrubTime);
      setIsScrubbing(false);
    };
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);
    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
    };
  }, [isScrubbing, scrubTime]);

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = rect.width > 0 ? x / rect.width : 0;
    const hoverVal = percent * safeDuration;
    if (Number.isFinite(hoverVal)) {
      setHoverSeekTime(hoverVal);
      setHoverSeekPos(x);
    }
  };

  const handleSeekMouseLeave = () => {
    setHoverSeekTime(null);
  };

  return (
    <footer className="select-none z-30 flex-shrink-0">
      {/* Mobile Mini Player Bar (< md) */}
      {currentTrack && (
        <div
          onClick={toggleLyrics}
          className="md:hidden flex flex-col bg-neutral-900/95 backdrop-blur-md border-t border-white/10 px-3 py-2 cursor-pointer relative"
        >
          {/* Subtle Top Progress Scrubber Line */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-white/20">
            <div
              className="h-full bg-spotify-green transition-[width] duration-150 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            {/* Artwork & Title/Artist */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-md overflow-hidden bg-neutral-800 flex-shrink-0 shadow-md">
                <img
                  src={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-xs font-bold text-white truncate">
                  {currentTrack.title}
                </span>
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    useUiStore.getState().setSelectedArtist(currentTrack.artist);
                  }}
                  className="text-[11px] text-spotify-subtext truncate hover:underline cursor-pointer"
                >
                  {currentTrack.artist}
                </span>
              </div>
            </div>

            {/* Quick Actions: Sing (Mute Singer), Like & Play/Pause */}
            <div
              className="flex items-center gap-1.5 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={toggleKaraokeMode}
                title={
                  isKaraokeMode
                    ? 'Karaoke ON: Singer Muted (Instruments Only) - Tap to restore'
                    : 'Karaoke Mode: Mute Singer & Play Instruments'
                }
                className={`p-2 rounded-full transition-all ${
                  isKaraokeMode
                    ? 'text-spotify-green bg-spotify-green/20 ring-1 ring-spotify-green shadow-[0_0_10px_rgba(29,185,84,0.4)]'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {isKaraokeMode ? <Music2 className="w-4 h-4 text-spotify-green" /> : <Mic2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => toggleLike(currentTrack.id, currentTrack)}
                title={isTrackLiked ? 'Remove from Liked' : 'Save to Liked'}
                className="p-2 text-neutral-400 hover:text-white transition-colors"
              >
                <Heart
                  className={`w-5 h-5 active:scale-125 transition-transform ${
                    isTrackLiked ? 'text-spotify-green fill-spotify-green' : ''
                  }`}
                />
              </button>

              <button
                onClick={togglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center active:scale-95 transition-transform shadow-md"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-black stroke-black" />
                ) : (
                  <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Full Transport Bar (md and up) */}
      <div className="hidden md:flex h-24 bg-spotify-black border-t border-spotify-border/60 px-4 items-center justify-between">
        {/* 1. Track Info (Left) */}
        <div className="flex items-center gap-3.5 w-1/4 min-w-[200px]">
        {currentTrack ? (
          <>
            <div 
              onClick={toggleMiniPlayer} 
              className="relative group w-14 h-14 rounded-md overflow-hidden bg-neutral-800 flex-shrink-0 cursor-pointer shadow-md"
            >
              <img
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-sm font-semibold text-white truncate hover:underline cursor-pointer">
                {currentTrack.title}
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  useUiStore.getState().setSelectedArtist(currentTrack.artist);
                }}
                className="text-xs text-spotify-subtext truncate hover:underline hover:text-white cursor-pointer mt-0.5"
              >
                {currentTrack.artist}
              </span>
            </div>

            {/* Like and Download Buttons */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                onClick={() => toggleLike(currentTrack.id, currentTrack)}
                title={isTrackLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                className="p-1.5 text-spotify-subtext hover:text-white transition-colors"
              >
                <Heart
                  className={`w-4 h-4 transition-transform active:scale-125 ${
                    isTrackLiked ? 'text-spotify-green fill-spotify-green' : ''
                  }`}
                />
              </button>

              {isTrackDownloaded ? (
                <div title="Downloaded for Offline Playback" className="p-1.5 text-spotify-green">
                  <CheckCircle2 className="w-4 h-4 fill-spotify-green text-black" />
                </div>
              ) : (
                <button
                  onClick={() => downloadTrack(currentTrack)}
                  disabled={isDownloading}
                  title="Download track for offline listening"
                  className="p-1.5 text-spotify-subtext hover:text-spotify-green transition-colors"
                >
                  {isDownloading ? (
                    <div className="w-4 h-4 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <DownloadCloud className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-md bg-white/5 flex items-center justify-center text-neutral-600">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div className="text-xs text-spotify-subdued">No track selected</div>
          </div>
        )}
      </div>

      {/* 2. Playback Controls & Scrubber (Center) */}
      <div className="flex flex-col items-center justify-center w-2/4 max-w-2xl px-4">
        {/* Top Control Buttons */}
        <div className="flex items-center gap-5 mb-2">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            title={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
            className={`relative p-1 transition-colors ${
              shuffle ? 'text-spotify-green' : 'text-spotify-subtext hover:text-white'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            {shuffle && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-spotify-green rounded-full" />}
          </button>

          {/* Previous */}
          <button
            onClick={previousTrack}
            title="Previous (Ctrl+Left)"
            className="p-1 text-spotify-subtext hover:text-white active:scale-95 transition-all"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-black stroke-black" />
            ) : (
              <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={nextTrack}
            title="Next (Ctrl+Right)"
            className="p-1 text-spotify-subtext hover:text-white active:scale-95 transition-all"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={toggleRepeat}
            title={`Repeat: ${repeat}`}
            className={`relative p-1 transition-colors ${
              repeat !== 'off' ? 'text-spotify-green' : 'text-spotify-subtext hover:text-white'
            }`}
          >
            {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            {repeat !== 'off' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-spotify-green rounded-full" />
            )}
          </button>
        </div>

        {/* Scrubber Progress Bar */}
        <div className="flex items-center gap-2.5 w-full">
          <span className="text-[11px] text-spotify-subdued tabular-nums w-8 text-right font-medium">
            {formatTime(displayTime)}
          </span>

          <div
            className="relative flex-1 flex items-center group py-2"
            onMouseMove={handleSeekMouseMove}
            onMouseLeave={handleSeekMouseLeave}
          >
            {/* Hover Timestamp Tooltip */}
            {hoverSeekTime !== null && (
              <div
                className="absolute -top-7 px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-white font-mono shadow-md pointer-events-none transform -translate-x-1/2"
                style={{ left: `${hoverSeekPos}px` }}
              >
                {formatTime(hoverSeekTime)}
              </div>
            )}

            {/* Custom Progress Bar Background */}
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden relative group-hover:h-1.5 transition-all">
              <div
                className={`h-full bg-white group-hover:bg-spotify-green rounded-full ${
                  isScrubbing ? '' : 'transition-[width] duration-150 ease-linear'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Native Slider Overlay with seamless scrub handling */}
            <input
              type="range"
              min={0}
              max={safeDuration}
              step={0.1}
              value={Math.min(displayTime, safeDuration)}
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onInput={handleSeekInput}
              onChange={handleSeekCommit}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label="Seek track"
            />
          </div>

          <span className="text-[11px] text-spotify-subdued tabular-nums w-8 font-medium">
            {formatTime(safeDuration)}
          </span>
        </div>
      </div>

      {/* 3. Extra Tools & Volume (Right) */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
        {/* Apple Music Sing (Karaoke & Vocal Level Slider) */}
        <KaraokeVocalSlider compact={true} />

        {/* Real-time Lyrics Toggle */}
        <button
          onClick={toggleLyrics}
          title="Lyrics (L)"
          className={`p-1.5 transition-colors ${
            isLyricsOpen || isFullscreenNowPlaying ? 'text-spotify-green' : 'text-spotify-subtext hover:text-white'
          }`}
        >
          <Mic2 className="w-4 h-4" />
        </button>

        {/* Queue Drawer Toggle */}
        <button
          onClick={toggleQueue}
          title="Play Queue"
          className={`p-1.5 transition-colors ${
            isQueueOpen ? 'text-spotify-green' : 'text-spotify-subtext hover:text-white'
          }`}
        >
          <ListMusic className="w-4 h-4" />
        </button>

        {/* 10-Band Equalizer Toggle */}
        <button
          onClick={toggleEqualizer}
          title="10-Band Equalizer & Visualizer (E)"
          className={`p-1.5 transition-colors ${
            isEqualizerOpen ? 'text-spotify-green' : 'text-spotify-subtext hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* Volume Controls with Permanent Green Progress Fill & Level Display */}
        <div className="flex items-center gap-2 group w-36 ml-1">
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            className="text-spotify-subtext hover:text-white p-1 flex-shrink-0"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-4 h-4 text-spotify-green" />
            ) : (
              <Volume2 className="w-4 h-4 text-spotify-green" />
            )}
          </button>

          <div className="relative flex-1 flex items-center py-2">
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden transition-all">
              <div
                className="h-full bg-spotify-green rounded-full shadow-[0_0_8px_rgba(29,185,84,0.5)] transition-all"
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val)) setVolume(val);
              }}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label="Volume slider"
            />
          </div>

          <span className="text-[11px] font-bold text-spotify-green tabular-nums w-8 text-right flex-shrink-0">
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>

        {/* Fullscreen Lyrics Toggle */}
        <button
          onClick={toggleFullscreenNowPlaying}
          title={isLyricsOpen || isFullscreenNowPlaying ? 'Exit Lyrics (F)' : 'Lyrics (F)'}
          className={`p-1.5 ml-1 transition-colors ${
            isLyricsOpen || isFullscreenNowPlaying ? 'text-spotify-green' : 'text-spotify-subtext hover:text-white'
          }`}
        >
          {isLyricsOpen || isFullscreenNowPlaying ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  </footer>
);
};
