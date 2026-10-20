import React from 'react';
import { Mic2, Music2, Sparkles, VolumeX } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';

interface KaraokeVocalSliderProps {
  compact?: boolean;
  className?: string;
}

/**
 * Karaoke Toggle Control: Mutes the singer completely and plays only the instruments.
 */
export const KaraokeVocalSlider: React.FC<KaraokeVocalSliderProps> = ({
  compact = false,
  className = '',
}) => {
  const {
    isKaraokeMode,
    karaokeStatusText,
    toggleKaraokeMode,
  } = usePlayerStore();

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <button
          onClick={toggleKaraokeMode}
          title={
            isKaraokeMode
              ? 'Karaoke Active: Singer Muted (Instruments Only) — Click to restore vocals'
              : 'Karaoke Mode: Mute Singer & Play Instruments'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
            isKaraokeMode
              ? 'bg-spotify-green text-black ring-1 ring-white/30 shadow-[0_0_12px_rgba(29,185,84,0.5)] scale-105'
              : 'text-neutral-300 bg-white/10 hover:text-white hover:bg-white/15'
          }`}
        >
          {isKaraokeMode ? (
            <>
              <Music2 className="w-3.5 h-3.5 text-black" />
              <span className="hidden sm:inline font-black tracking-tight">Instruments</span>
              <span className="text-[10px] font-black uppercase px-1 py-0.2 bg-black/20 rounded text-black">
                Muted
              </span>
            </>
          ) : (
            <>
              <Mic2 className="w-3.5 h-3.5 text-spotify-green" />
              <span className="font-semibold">Karaoke</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Expanded Card for Fullscreen Now Playing left panel
  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl shadow-2xl ${className}`}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl transition-all ${
              isKaraokeMode
                ? 'bg-spotify-green text-black shadow-[0_0_16px_rgba(29,185,84,0.4)]'
                : 'bg-white/10 text-neutral-400'
            }`}
          >
            {isKaraokeMode ? (
              <Music2 className="w-5 h-5 text-black" />
            ) : (
              <Mic2 className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">
                Karaoke Mode
              </span>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isKaraokeMode
                    ? 'bg-spotify-green text-black'
                    : 'bg-white/10 text-neutral-400'
                }`}
              >
                {isKaraokeMode ? 'Instruments Only' : 'Original Track'}
              </span>
            </div>
            <span className="text-xs text-neutral-400 mt-0.5">
              {isKaraokeMode
                ? 'Singer muted • Playing rhythm, beat & instruments'
                : 'Normal playback • Singer & instruments playing'}
            </span>
            {karaokeStatusText && isKaraokeMode && (
              <span className="text-[11px] text-spotify-green font-semibold mt-0.5 truncate max-w-xs animate-pulse">
                {karaokeStatusText}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Single-Click Toggle Button */}
      <button
        onClick={toggleKaraokeMode}
        className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
          isKaraokeMode
            ? 'bg-spotify-green text-black hover:bg-spotify-green/90 shadow-[0_0_14px_rgba(29,185,84,0.4)] active:scale-98'
            : 'bg-white/10 hover:bg-white/15 text-white border border-white/10 active:scale-98'
        }`}
      >
        {isKaraokeMode ? (
          <>
            <VolumeX className="w-4 h-4 text-black" />
            <span>Singer Muted (Tap to Restore Vocals)</span>
          </>
        ) : (
          <>
            <Mic2 className="w-4 h-4 text-spotify-green" />
            <span>Mute Singer & Play Instruments</span>
          </>
        )}
      </button>
    </div>
  );
};
