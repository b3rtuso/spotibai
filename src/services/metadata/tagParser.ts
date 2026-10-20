import * as mm from 'music-metadata-browser';
import { Track } from '../../types';

export async function parseLocalAudioFile(file: File): Promise<Track> {
  const id = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const defaultArtwork = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';

  let title = file.name.replace(/\.[^/.]+$/, '');
  let artist = 'Unknown Artist';
  let album = 'Local Files';
  let duration = 0;
  let genre = 'Local Audio';
  let year: number | undefined;
  let artworkUrl = defaultArtwork;
  let artworkBlob: Blob | undefined;

  // Try parsing file name like "Artist - Title"
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  try {
    const metadata = await mm.parseBlob(file);
    if (metadata.common.title) title = metadata.common.title;
    if (metadata.common.artist) artist = metadata.common.artist;
    if (metadata.common.album) album = metadata.common.album;
    if (metadata.common.year) year = metadata.common.year;
    if (metadata.common.genre && metadata.common.genre[0]) genre = metadata.common.genre[0];
    if (metadata.format.duration) duration = Math.round(metadata.format.duration);

    // Extract cover artwork if present
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      artworkBlob = new Blob([pic.data as BlobPart], { type: pic.format });
      artworkUrl = URL.createObjectURL(artworkBlob);
    }
  } catch (err) {
    console.warn('ID3 tag parse error, falling back to file attributes:', err);
  }

  // If duration is still 0, determine using HTML5 Audio element
  if (duration === 0) {
    try {
      duration = await getAudioDuration(file);
    } catch {
      duration = 180;
    }
  }

  const track: Track = {
    id,
    title,
    artist,
    album,
    duration,
    genre,
    year,
    audioUrl: URL.createObjectURL(file),
    audioBlob: file, // Store the local file blob in IndexedDB
    artworkUrl,
    artworkBlob,
    sourceType: 'local',
    isDownloaded: true, // Local files are immediately offline
    dateAdded: Date.now(),
  };

  return track;
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    audio.addEventListener('loadedmetadata', () => {
      const dur = Math.round(audio.duration);
      URL.revokeObjectURL(objectUrl);
      resolve(dur || 180);
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      resolve(180);
    });
  });
}

/**
 * Revitalizes revoked blob URLs for persisted audio and artwork blobs after page reload
 */
export function revitalizeTrackBlobUrls(track: Track): Track {
  let audioUrl = track.audioUrl;
  let artworkUrl = track.artworkUrl;

  if (track.audioBlob) {
    if (!audioUrl || audioUrl.startsWith('blob:') || !audioUrl.startsWith('http')) {
      try {
        audioUrl = URL.createObjectURL(track.audioBlob);
      } catch (e) {
        console.warn('Failed to create object URL for audioBlob:', e);
      }
    }
  }

  if (track.artworkBlob) {
    try {
      artworkUrl = URL.createObjectURL(track.artworkBlob);
    } catch (e) {
      console.warn('Failed to create object URL for artworkBlob:', e);
    }
  }

  return {
    ...track,
    audioUrl,
    artworkUrl,
  };
}

