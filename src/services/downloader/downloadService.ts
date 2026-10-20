import { db } from '../db/database';
import { Track, Playlist } from '../../types';

export class DownloadService {
  /**
   * Downloads a track's audio and artwork into IndexedDB as persistent blobs for 100% offline playback
   */
  public async downloadTrack(
    track: Track,
    onProgress?: (percent: number) => void
  ): Promise<Track> {
    try {
      if (onProgress) onProgress(0);

      let audioBlob: Blob | undefined = track.audioBlob;
      let artworkBlob: Blob | undefined = track.artworkBlob;

      // 1. Identify download stream source (direct audioUrl, previewUrl, or search for stream)
      const isDirectStream =
        track.sourceType !== 'youtube' &&
        Boolean(track.audioUrl) &&
        !track.audioUrl.includes('youtube.com') &&
        !track.audioUrl.includes('youtu.be');

      let candidateStreamUrl: string | undefined = undefined;
      if (isDirectStream) {
        candidateStreamUrl = track.audioUrl;
      } else if (track.previewUrl) {
        candidateStreamUrl = track.previewUrl;
      }

      if (onProgress) onProgress(20);

      // If YouTube or stream-only track has no previewUrl, attempt to resolve via iTunes metadata search
      if (!candidateStreamUrl && !audioBlob && track.title && track.artist) {
        try {
          const res = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              `${track.title} ${track.artist}`
            )}&entity=song&limit=1`,
            { signal: AbortSignal.timeout(4000) }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.results?.[0]?.previewUrl) {
              candidateStreamUrl = data.results[0].previewUrl;
              if (!track.previewUrl) {
                track.previewUrl = candidateStreamUrl;
              }
              if (!artworkBlob && !track.artworkUrl && data.results[0].artworkUrl100) {
                track.artworkUrl = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
              }
            }
          }
        } catch {
          // fallback
        }
      }

      if (candidateStreamUrl && !audioBlob) {
        if (onProgress) onProgress(35);
        try {
          const fetchUrl = candidateStreamUrl.startsWith('http')
            ? candidateStreamUrl
            : (typeof window !== 'undefined' && window.location?.origin
                ? `${window.location.origin}${candidateStreamUrl}`
                : `http://localhost:5173${candidateStreamUrl}`);
          const response = await fetch(fetchUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob && blob.size > 0) {
              audioBlob = blob;
            }
            if (onProgress) onProgress(75);
          } else {
            console.warn(`Stream fetch returned HTTP ${response.status} for ${candidateStreamUrl}`);
          }
        } catch (fetchErr) {
          console.warn('Stream fetch failed:', fetchErr);
        }
      } else if (audioBlob) {
        if (onProgress) {
          onProgress(50);
          onProgress(75);
        }
      }

      // 2. Fetch and store artwork blob if available
      if (!artworkBlob && track.artworkUrl && !track.artworkUrl.startsWith('data:') && !track.artworkUrl.startsWith('blob:')) {
        try {
          const artUrl = track.artworkUrl.startsWith('http')
            ? track.artworkUrl
            : (typeof window !== 'undefined' && window.location?.origin
                ? `${window.location.origin}${track.artworkUrl}`
                : `http://localhost:5173${track.artworkUrl}`);
          const artRes = await fetch(artUrl);
          if (artRes.ok) {
            const blob = await artRes.blob();
            if (blob && blob.size > 0) {
              artworkBlob = blob;
            }
            if (onProgress) onProgress(90);
          }
        } catch {
          // Artwork fetch optional
        }
      }

      // 3. Only persist isDownloaded: true when audioBlob is non-empty Blob
      const isAudioSuccess = Boolean(audioBlob && audioBlob instanceof Blob && audioBlob.size > 0);
      const isDownloaded = isAudioSuccess;

      let finalAudioUrl = track.audioUrl;
      let finalArtworkUrl = track.artworkUrl;

      if (isAudioSuccess && audioBlob) {
        try {
          if (!finalAudioUrl || finalAudioUrl.startsWith('blob:') || !finalAudioUrl.startsWith('http')) {
            finalAudioUrl = URL.createObjectURL(audioBlob);
          }
        } catch (e) {
          console.warn('Failed to create object URL for audioBlob:', e);
        }
      }

      if (artworkBlob) {
        try {
          if (!finalArtworkUrl || finalArtworkUrl.startsWith('blob:') || !finalArtworkUrl.startsWith('http')) {
            finalArtworkUrl = URL.createObjectURL(artworkBlob);
          }
        } catch (e) {
          console.warn('Failed to create object URL for artworkBlob:', e);
        }
      }

      // 4. Update track in IndexedDB
      const updatedTrack: Track = {
        ...track,
        isDownloaded,
        audioBlob: isAudioSuccess ? audioBlob : undefined,
        artworkBlob,
        audioUrl: finalAudioUrl,
        artworkUrl: finalArtworkUrl,
      };

      await db.tracks.put(updatedTrack);
      if (onProgress) onProgress(100);

      return updatedTrack;
    } catch (error) {
      console.error('Download track failed:', error);
      throw error;
    }
  }

  /**
   * Removes offline audio blob to free up device storage
   */
  public async removeDownloadedTrack(trackId: string): Promise<void> {
    const track = await db.tracks.get(trackId);
    if (track) {
      const updated: Track = {
        ...track,
        isDownloaded: false,
        audioBlob: undefined,
      };
      await db.tracks.put(updated);
    }
  }

  /**
   * Downloads an entire playlist for offline listening
   */
  public async downloadPlaylist(
    playlist: Playlist,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    const total = playlist.trackIds.length;
    let completed = 0;

    for (const trackId of playlist.trackIds) {
      const track = await db.tracks.get(trackId);
      if (track && !track.isDownloaded) {
        try {
          await this.downloadTrack(track);
        } catch (e) {
          console.warn(`Failed downloading track ${trackId}:`, e);
        }
      }
      completed++;
      if (onProgress) onProgress(completed, total);
    }

    await db.playlists.update(playlist.id, { isDownloaded: true });
  }

  /**
   * Exports an audio track directly to the user's operating system Downloads folder as an MP3 file
   */
  public async exportTrackToDisk(track: Track) {
    if (track.audioBlob) {
      const url = URL.createObjectURL(track.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      const sanitizedTitle = `${track.artist} - ${track.title}`.replace(/[/\\?%*:|"<>]/g, '-');
      a.download = `${sanitizedTitle}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }

    const streamUrl =
      (track.sourceType !== 'youtube' &&
      !track.audioUrl.includes('youtube.com') &&
      !track.audioUrl.includes('youtu.be')
        ? track.audioUrl
        : null) || track.previewUrl;

    if (streamUrl) {
      try {
        const res = await fetch(streamUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const sanitizedTitle = `${track.artist} - ${track.title}`.replace(/[/\\?%*:|"<>]/g, '-');
        a.download = `${sanitizedTitle}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (e) {
        console.warn('Failed exporting track:', e);
      }
    } else {
      window.open(track.audioUrl, '_blank');
    }
  }
}

export const downloadService = new DownloadService();
