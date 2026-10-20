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

  // Minimized Compact Bar for Fullscreen Now Playing left panel
  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md shadow-md gap-3 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`p-1.5 rounded-lg flex-shrink-0 transition-all ${
            isKaraokeMode
              ? 'bg-spotify-green text-black'
              : 'bg-white/10 text-neutral-300'
          }`}
        >
          {isKaraokeMode ? (
            <Music2 className="w-4 h-4 text-black" />
          ) : (
            <Mic2 className="w-4 h-4 text-white" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white tracking-wide truncate">
              Karaoke Mode
            </span>
            <span
              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                isKaraokeMode
                  ? 'bg-spotify-green text-black'
                  : 'bg-white/10 text-neutral-400'
              }`}
            >
              {isKaraokeMode ? 'Instruments Only' : 'Original Track'}
            </span>
          </div>
          {karaokeStatusText && isKaraokeMode && (
            <span className="text-[10px] text-spotify-green font-semibold truncate animate-pulse">
              {karaokeStatusText}
            </span>
          )}
        </div>
      </div>

      {/* Single-Click Toggle Button */}
      <button
        onClick={toggleKaraokeMode}
        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 shadow cursor-pointer active:scale-95 ${
          isKaraokeMode
            ? 'bg-spotify-green text-black hover:bg-spotify-green/90 shadow-[0_0_10px_rgba(29,185,84,0.4)]'
            : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
        }`}
      >
        {isKaraokeMode ? (
          <>
            <VolumeX className="w-3.5 h-3.5 text-black" />
            <span>Singer Muted (Tap to Restore Vocals)</span>
          </>
        ) : (
          <>
            <Mic2 className="w-3.5 h-3.5 text-spotify-green" />
            <span>Mute Singer & Play Instruments</span>
          </>
        )}
      </button>
    </div>
  );
};
