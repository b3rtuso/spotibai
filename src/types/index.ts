export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  audioUrl: string; // URL or blob URL
  artworkUrl: string;
  sourceType: 'online' | 'local' | 'youtube';
  youtubeId?: string;
  instrumentalYoutubeId?: string;
  karaokeStems?: {
    vocalsUrl: string;
    instrumentalUrl: string;
    isReady: boolean;
  };
  previewUrl?: string;
  isLiked?: boolean;
  isDownloaded?: boolean;
  audioBlob?: Blob;
  artworkBlob?: Blob;
  lyrics?: string;
  genre?: string;
  year?: number;
  dateAdded: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  isCustom: boolean;
  isDownloaded?: boolean;
  createdAt: number;
}

export interface LyricsWord {
  text: string;
  timeMs: number;
}

export interface LyricsLine {
  timeMs: number;
  text: string;
  words?: LyricsWord[];
}

export type KaraokeStatus = 'idle' | 'processing' | 'ready' | 'error';

export interface EqualizerBand {
  frequency: number;
  gain: number; // -12dB to +12dB
}

export interface EqualizerPreset {
  id: string;
  name: string;
  gains: number[]; // 10 values for the 10 bands
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface Artist {
  id: string;
  name: string;
  avatarUrl: string;
  genre?: string;
  followers?: number;
  monthlyListeners?: number;
  bio?: string;
  isFollowed?: boolean;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  coverUrl: string;
  releaseYear?: number;
  trackCount?: number;
  genre?: string;
  tracks?: Track[];
}

export type ActiveView = 
  | 'home' 
  | 'search' 
  | 'library' 
  | 'playlist' 
  | 'liked' 
  | 'downloaded' 
  | 'local'
  | 'artist'
  | 'album';

export type VisualizerStyle = 'bars' | 'wave' | 'pulse';

