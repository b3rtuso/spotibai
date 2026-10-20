import Dexie, { Table } from 'dexie';
import { Track, Playlist } from '../../types';

export interface HistoryItem {
  id?: number;
  trackId: string;
  playedAt: number;
}

export interface AppSetting {
  key: string;
  value: any;
}

export class SpotibaiDatabase extends Dexie {
  tracks!: Table<Track, string>;
  playlists!: Table<Playlist, string>;
  history!: Table<HistoryItem, number>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('SpotibaiDB');
    this.version(2).stores({
      tracks: 'id, title, artist, album, sourceType, isLiked, isDownloaded, dateAdded',
      playlists: 'id, name, isCustom, isDownloaded, createdAt',
      history: '++id, trackId, playedAt',
      settings: 'key',
    });
  }
}

export const db = new SpotibaiDatabase();

// Curated Initial Catalog of High-Quality Offline & Local Audio
export const INITIAL_TRACKS: Track[] = [
  {
    id: 'track-1',
    title: 'Enthusiast',
    artist: 'Tours',
    album: 'Neon Horizon',
    duration: 184,
    audioUrl: '/audio/enthusiast.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    sourceType: 'online',
    isLiked: true,
    genre: 'Synthwave',
    year: 2024,
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 3,
    lyrics: `[00:00.00]Cruising down the highway in the neon rain
[00:09.50]Reflections on the glass wash away the pain
[00:19.00]Digital horizon shining bright and blue
[00:29.00]Every turning road is leading back to you
[00:39.00]Synthwave pulses through the electric air
[00:48.50]Feel the midnight rhythm everywhere
[00:58.00]Lost inside the beat until the morning light
[01:08.00]We own the city tonight
[01:18.00]Neon dreams will never fade away
[01:28.00]Driving through the dark until the dawn of day`
  },
  {
    id: 'track-2',
    title: 'Night Owl',
    artist: 'Broke For Free',
    album: 'Directionless EP',
    duration: 201,
    audioUrl: '/audio/night_owl.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80',
    sourceType: 'online',
    isLiked: false,
    genre: 'Lo-Fi Chill',
    year: 2024,
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 2,
    lyrics: `[00:00.00]Soft rain falling on the window sill
[00:10.00]A quiet cup of coffee while the world stands still
[00:22.00]Pages turning slowly in the afternoon
[00:34.00]Humming along to an old sweet tune
[00:46.00]Warm breeze through the open door
[00:58.00]Simple moments we were waiting for
[01:10.00]Gentle melodies ease the mind
[01:22.00]Peace of heart is what we find`
  },
  {
    id: 'track-3',
    title: 'Summer Groove',
    artist: 'Sound Wave',
    album: 'Golden Days',
    duration: 184,
    audioUrl: '/audio/sample_groove.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    sourceType: 'online',
    isLiked: true,
    genre: 'Electronic Funk',
    year: 2023,
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 5,
    lyrics: `[00:00.00]Floating past the rings of Saturn in the deep
[00:12.00]Cosmic lullabies while the stars are asleep
[00:25.00]Infinite darkness illuminated bright
[00:38.00]Catching constellations in the silent night
[00:52.00]Drifting through the nebula of timeless grace
[01:05.00]Echoes of eternity in outer space
[01:20.00]Weightless freedom, boundless and serene
[01:35.00]The most beautiful view that I have ever seen`
  },
  {
    id: 'track-4',
    title: 'Coffee Shop Study',
    artist: 'Acoustic Ambience',
    album: 'Rainy Cafe',
    duration: 156,
    audioUrl: '/audio/coffee_shop.ogg',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    sourceType: 'online',
    isLiked: false,
    genre: 'Acoustic & Lofi',
    year: 2024,
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 1,
    lyrics: `[00:00.00]Fingerpicking chords in the golden light
[00:11.00]Sitting on the porch as day turns into night
[00:23.00]Whispering pines and a campfire glow
[00:35.00]Watching amber embers floating soft and slow
[00:48.00]Nothing but the music and the open sky
[01:00.00]Singing simple songs as the hours go by
[01:14.00]Here with you right where we belong
[01:27.00]Writing our chapter in an acoustic song`
  }
];

export const INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'playlist-top-hits',
    name: "Spotibai's Top Hits",
    description: 'The hottest tracks trending right now on Spotibai.',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    trackIds: ['track-1', 'track-2', 'track-3', 'track-4'],
    isCustom: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
  {
    id: 'playlist-chill-lofi',
    name: 'Chill Lofi Study Beats',
    description: 'Relaxing beats to code, study, chill, and relax to.',
    coverUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80',
    trackIds: ['track-2', 'track-4'],
    isCustom: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
  },
  {
    id: 'playlist-synthwave-nights',
    name: 'Synthwave & Cyberpunk',
    description: 'Retro futuristic synthesizers and driving basslines.',
    coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    trackIds: ['track-1', 'track-3'],
    isCustom: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  }
];

export async function initializeDatabase() {
  const existingTracks = await db.tracks.toArray();

  // 1. Purge dead tracks from previous sessions (Audius nodes, Pixabay 403s, or broken initial tracks)
  const isDeadOrOutdatedTrack = (t: Track) => {
    if (!t.audioUrl && !t.audioBlob) return true;
    if (t.audioUrl && (t.audioUrl.includes('audius') || t.audioUrl.includes('pixabay.com'))) return true;
    const isCoreTrack = INITIAL_TRACKS.some((it) => it.id === t.id);
    if (isCoreTrack && (!t.audioUrl.startsWith('/audio/') || t.audioUrl.includes('audius')) && !t.audioBlob) {
      return true;
    }
    return false;
  };

  const toDelete = existingTracks.filter(isDeadOrOutdatedTrack);
  for (const track of toDelete) {
    await db.tracks.delete(track.id);
  }

  // 2. Ensure all core initial tracks are present with verified local audio URLs
  for (const track of INITIAL_TRACKS) {
    const existing = await db.tracks.get(track.id);
    if (!existing || (!existing.audioUrl?.startsWith('/audio/') && !existing.audioBlob)) {
      await db.tracks.put(track);
    }
  }

  // 3. Ensure core playlists are present
  for (const pl of INITIAL_PLAYLISTS) {
    const existing = await db.playlists.get(pl.id);
    if (!existing) {
      await db.playlists.put(pl);
    }
  }
}
