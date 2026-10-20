import React, { useEffect, useRef, useState } from 'react';
import { X, Sliders, Activity, Zap, RefreshCw, Sparkles } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useUiStore } from '../../store/uiStore';
import { audioEngine, EQ_FREQUENCIES, EQ_PRESETS } from '../../services/audio/AudioEngine';
import { VisualizerStyle } from '../../types';

export const EqualizerModal: React.FC = () => {
  const { isEqualizerOpen, toggleEqualizer } = useUiStore();
  const { eqGains, activePresetId, setEqGain, applyPreset, crossfade, setCrossfade } = usePlayerStore();

  const [visualizerMode, setVisualizerMode] = useState<VisualizerStyle>('bars');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEqualizerOpen) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { frequency, waveform } = audioEngine.getVisualizerData();
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (visualizerMode === 'bars') {
        // Draw frequency bars
        const numBars = 36;
        const barWidth = (width / numBars) - 2;
        const step = Math.floor(frequency.length / numBars);

        for (let i = 0; i < numBars; i++) {
          const val = frequency[i * step] || 0;
          const barHeight = (val / 255) * (height - 10);
          const x = i * (barWidth + 2);
          const y = height - barHeight;

          // Gradient from Spotify green to bright cyan
          const grad = ctx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, '#1DB954');
          grad.addColorStop(1, '#1ed760');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, Math.max(3, barHeight), [3, 3, 0, 0]);
          ctx.fill();
        }
      } else if (visualizerMode === 'wave') {
        // Draw glowing oscilloscope waveform
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#1ed760';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#1DB954';
        ctx.beginPath();

        const sliceWidth = width / waveform.length;
        let x = 0;

        for (let i = 0; i < waveform.length; i++) {
          const v = waveform[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      } else if (visualizerMode === 'pulse') {
        // Draw pulsing circular orb
        let avg = 0;
        for (let i = 0; i < 16; i++) avg += frequency[i];
        avg = avg / 16;

        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = 30;
        const radius = baseRadius + (avg / 255) * 45;

        const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius);
        grad.addColorStop(0, 'rgba(30, 215, 96, 0.9)');
        grad.addColorStop(0.6, 'rgba(29, 185, 84, 0.4)');
        grad.addColorStop(1, 'rgba(29, 185, 84, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + (avg / 255) * 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isEqualizerOpen, visualizerMode]);

  if (!isEqualizerOpen) return null;

  const formatFreqLabel = (freq: number) => {
    return freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-spotify-card border border-white/10 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-spotify-green/20 text-spotify-green">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                10-Band Equalizer & Visualizer
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-spotify-green/20 text-spotify-green">
                  Studio DSP
                </span>
              </h2>
              <p className="text-xs text-spotify-subdued">Hardware-accelerated Web Audio frequency shaping</p>
            </div>
          </div>

          <button
            onClick={toggleEqualizer}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time Visualizer Canvas */}
        <div className="bg-black/60 rounded-xl p-3 border border-white/5 mb-6 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-spotify-subtext flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-spotify-green" />
              Real-Time Spectrum
            </span>

            {/* Visualizer Mode Switcher */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
              <button
                onClick={() => setVisualizerMode('bars')}
                className={`text-xs px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                  visualizerMode === 'bars' ? 'bg-spotify-green text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Bars
              </button>
              <button
                onClick={() => setVisualizerMode('wave')}
                className={`text-xs px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                  visualizerMode === 'wave' ? 'bg-spotify-green text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Wave
              </button>
              <button
                onClick={() => setVisualizerMode('pulse')}
                className={`text-xs px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                  visualizerMode === 'pulse' ? 'bg-spotify-green text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Pulse
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={580}
            height={110}
            className="w-full h-28 rounded-lg bg-black/40"
          />
        </div>

        {/* Preset Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white/5 p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-spotify-green" />
            <span className="text-xs font-semibold text-white">Preset:</span>
            <select
              value={activePresetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="bg-spotify-elevated text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 outline-none cursor-pointer hover:border-spotify-green transition-colors"
            >
              {EQ_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
              {activePresetId === 'custom' && <option value="custom">Custom (Modified)</option>}
            </select>
          </div>

          <button
            onClick={() => applyPreset('flat')}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Flat (0 dB)
          </button>
        </div>

        {/* 10-Band Sliders (Scrollable on small mobile screens) */}
        <div className="overflow-x-auto mb-6 py-2 px-1 bg-black/30 rounded-xl scrollbar-thin">
          <div className="grid grid-cols-10 min-w-[480px] gap-2 items-center justify-items-center">
          {EQ_FREQUENCIES.map((freq, idx) => {
            const gain = eqGains[idx] || 0;
            return (
              <div key={freq} className="flex flex-col items-center gap-2 h-48 justify-between">
                {/* dB display */}
                <span className={`text-[10px] font-mono font-bold ${gain !== 0 ? 'text-spotify-green' : 'text-neutral-400'}`}>
                  {gain > 0 ? `+${gain}dB` : `${gain}dB`}
                </span>

                {/* Vertical Range Slider */}
                <div className="relative flex items-center justify-center h-32 w-6">
                  {/* Center line (0dB) */}
                  <div className="absolute w-4 h-[1.5px] bg-white/30 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={gain}
                    onChange={(e) => setEqGain(idx, parseFloat(e.target.value))}
                    className="eq-slider w-32 h-6 -rotate-90 cursor-pointer"
                  />
                </div>

                {/* Frequency Label */}
                <span className="text-[11px] font-semibold text-neutral-300">
                  {formatFreqLabel(freq)}
                </span>
              </div>
            );
          })}
          </div>
        </div>

        {/* Crossfade Duration Control */}
        <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-white">Crossfade Songs</div>
              <div className="text-xs text-spotify-subdued">Smooth volume transition when switching songs</div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-48">
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={crossfade}
              onChange={(e) => setCrossfade(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-white/20 rounded-full"
            />
            <span className="text-xs font-mono font-bold text-spotify-green w-8 text-right">
              {crossfade}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
