import React, { useEffect } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { TopBar } from './TopBar';
import { MobileNavBar } from './MobileNavBar';
import { PlayerBar } from '../player/PlayerBar';
import { HomeView } from '../views/HomeView';
import { SearchView } from '../views/SearchView';
import { LibraryView } from '../views/LibraryView';
import { PlaylistView } from '../views/PlaylistView';
import { ArtistView } from '../views/ArtistView';
import { AlbumView } from '../views/AlbumView';
import { LyricsModal } from '../lyrics/LyricsModal';
import { EqualizerModal } from '../equalizer/EqualizerModal';
import { QueueDrawer } from '../queue/QueueDrawer';
import { MiniPlayer } from '../player/MiniPlayer';
import { ImportModal } from '../modals/ImportModal';
import { SpotifyImportModal } from '../modals/SpotifyImportModal';
import { EditPlaylistModal } from '../modals/EditPlaylistModal';
import { ShortcutsModal } from '../modals/ShortcutsModal';
import { AuthModal } from '../modals/AuthModal';
import { FullscreenNowPlaying } from '../player/FullscreenNowPlaying';
import { YouTubePlayerContainer } from '../player/YouTubePlayerContainer';
import { useUiStore } from '../../store/uiStore';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';

export const AppLayout: React.FC = () => {
  const {
    activeView,
    ambientColor,
    toggleLyrics,
    toggleEqualizer,
    toggleFullscreen,
    toggleFullscreenNowPlaying,
    toggleShortcuts,
    isShortcutsOpen,
    isFullscreenNowPlaying,
    isEditPlaylistOpen,
    closeEditPlaylist,
  } = useUiStore();
  const { init: initPlayer, togglePlay, nextTrack, previousTrack, setVolume, volume, toggleMute } = usePlayerStore();
  const { loadLibrary } = useLibraryStore();

  useEffect(() => {
    initPlayer();
    loadLibrary();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && (e.code === 'Slash' || e.key === '?'))) {
        e.preventDefault();
        toggleShortcuts();
      } else if (e.code === 'Escape') {
        if (isFullscreenNowPlaying) toggleFullscreenNowPlaying();
        else if (isShortcutsOpen) toggleShortcuts();
        else if (isEditPlaylistOpen) closeEditPlaylist();
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.ctrlKey && e.code === 'ArrowRight') {
        e.preventDefault();
        nextTrack();
      } else if (e.ctrlKey && e.code === 'ArrowLeft') {
        e.preventDefault();
        previousTrack();
      } else if (e.ctrlKey && e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.1));
      } else if (e.ctrlKey && e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.1));
      } else if (e.code === 'KeyM') {
        toggleMute();
      } else if (e.code === 'KeyL') {
        toggleLyrics();
      } else if (e.code === 'KeyE') {
        toggleEqualizer();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreenNowPlaying();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isFullscreenNowPlaying, isShortcutsOpen, isEditPlaylistOpen]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-black text-white relative">
      {/* Headless YouTube Player Container */}
      <YouTubePlayerContainer />

      {/* App Body (Sidebar + Content) */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 relative flex flex-col overflow-hidden bg-spotify-black">
          {/* Dynamic Ambient Background Glow */}
          <div
            className="absolute top-0 inset-x-0 h-96 pointer-events-none transition-all duration-1000 ease-out opacity-40 z-0"
            style={{
              background: `radial-gradient(circle at 50% -20%, ${ambientColor} 0%, transparent 75%)`,
            }}
          />

          <TopBar />

          {/* Viewport Router */}
          <div className="flex-1 overflow-y-auto relative z-10 scrollbar-thin">
            {activeView === 'home' && <HomeView />}
            {activeView === 'search' && <SearchView />}
            {activeView === 'library' && <LibraryView />}
            {activeView === 'artist' && <ArtistView />}
            {activeView === 'album' && <AlbumView />}
            {(activeView === 'playlist' ||
              activeView === 'liked' ||
              activeView === 'downloaded' ||
              activeView === 'local') && <PlaylistView />}
          </div>
        </main>

        {/* Slide-out Queue Drawer */}
        <QueueDrawer />
      </div>

      {/* Sticky Bottom Player Bar */}
      <PlayerBar />

      {/* Mobile Bottom Navigation Bar (hidden on desktop) */}
      <MobileNavBar />

      {/* Floating Modals & Overlays */}
      <LyricsModal />
      <EqualizerModal />
      <MiniPlayer />
      <ImportModal />
      <SpotifyImportModal />
      <EditPlaylistModal />
      <ShortcutsModal />
      <FullscreenNowPlaying />
      <AuthModal />
    </div>
  );
};
