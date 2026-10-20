import React from 'react';
import { Home, Search, Library } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

export const MobileNavBar: React.FC = () => {
  const { activeView, setActiveView } = useUiStore();

  const isLibraryActive =
    activeView === 'library' ||
    activeView === 'playlist' ||
    activeView === 'liked' ||
    activeView === 'downloaded' ||
    activeView === 'local';

  return (
    <nav className="md:hidden bg-neutral-950/95 backdrop-blur-xl border-t border-white/10 px-4 py-2 flex items-center justify-around select-none z-40 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {/* Home Tab */}
      <button
        onClick={() => setActiveView('home')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${
          activeView === 'home' ? 'text-white' : 'text-neutral-400 hover:text-white'
        }`}
      >
        <Home className={`w-5 h-5 ${activeView === 'home' ? 'text-white fill-white/20' : ''}`} />
        <span className="text-[10px] font-semibold mt-1">Home</span>
      </button>

      {/* Search Tab */}
      <button
        onClick={() => setActiveView('search')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${
          activeView === 'search' ? 'text-white' : 'text-neutral-400 hover:text-white'
        }`}
      >
        <Search className={`w-5 h-5 ${activeView === 'search' ? 'text-white stroke-[2.5]' : ''}`} />
        <span className="text-[10px] font-semibold mt-1">Search</span>
      </button>

      {/* Library Tab */}
      <button
        onClick={() => setActiveView('library')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${
          isLibraryActive ? 'text-white' : 'text-neutral-400 hover:text-white'
        }`}
      >
        <Library className={`w-5 h-5 ${isLibraryActive ? 'text-white fill-white/20' : ''}`} />
        <span className="text-[10px] font-semibold mt-1">Your Library</span>
      </button>
    </nav>
  );
};
