import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

const SHORTCUT_GROUPS = [
  {
    category: 'Playback Controls',
    items: [
      { key: 'Space', desc: 'Play / Pause' },
      { key: 'Ctrl + →', desc: 'Next track' },
      { key: 'Ctrl + ←', desc: 'Previous track (or restart if >3s)' },
      { key: 'Ctrl + ↑', desc: 'Increase volume (+10%)' },
      { key: 'Ctrl + ↓', desc: 'Decrease volume (-10%)' },
      { key: 'M', desc: 'Mute / Unmute' },
    ],
  },
  {
    category: 'Display & Navigation',
    items: [
      { key: 'L', desc: 'Toggle Real-Time Synced Lyrics' },
      { key: 'E', desc: 'Toggle 10-Band Equalizer & Visualizer' },
      { key: 'Q', desc: 'Toggle Play Queue' },
      { key: 'F', desc: 'Toggle Fullscreen Lyrics Mode' },
      { key: '?', desc: 'Show this keyboard shortcuts guide' },
    ],
  },
];

export const ShortcutsModal: React.FC = () => {
  const { isShortcutsOpen, toggleShortcuts } = useUiStore();

  if (!isShortcutsOpen) return null;

  return (
    <div 
      onClick={toggleShortcuts}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative"
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-spotify-green" />
            <h2 className="text-xl font-black text-white tracking-tight">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={toggleShortcuts}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {SHORTCUT_GROUPS.map((grp) => (
            <div key={grp.category}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-spotify-subdued mb-3">
                {grp.category}
              </h3>
              <div className="space-y-2">
                {grp.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-sm text-neutral-300">{item.desc}</span>
                    <kbd className="px-2.5 py-1 text-xs font-mono font-bold text-white bg-neutral-800 border border-white/10 rounded shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-neutral-500">
          Press any key or shortcut anywhere in the app for instant control
        </div>
      </div>
    </div>
  );
};
