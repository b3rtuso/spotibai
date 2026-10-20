import { Playlist, Track } from '../../types';

export interface SpotifyImportResult {
  playlist: Playlist;
  tracks: Track[];
}

export class SpotifyImporter {
  /**
   * Extracts clean Spotify playlist ID from URL or URI
   */
  public extractPlaylistId(input: string): string | null {
    const trimmed = input.trim();
    // Matches https://open.spotify.com/playlist/XYZ or spotify:playlist:XYZ
    const urlMatch = trimmed.match(/playlist[/:]([a-zA-Z0-9]+)/);
    if (urlMatch) return urlMatch[1];
    if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
    return null;
  }

  /**
   * Imports a public Spotify playlist by extracting its public embed metadata
   */
  public async importPlaylistFromUrl(urlOrId: string): Promise<SpotifyImportResult> {
    const playlistId = this.extractPlaylistId(urlOrId);
    if (!playlistId) {
      throw new Error('Invalid Spotify playlist URL. Please make sure the link is in the format: https://open.spotify.com/playlist/...');
    }

    // Attempt fetching via Vite dev proxy first, then direct
    let html = '';
    try {
      const res = await fetch(`/api/spotify-embed/playlist/${playlistId}`);
      if (res.ok) {
        html = await res.text();
      }
    } catch {
      // Fallback
    }

    if (!html) {
      try {
        const directRes = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`);
        if (directRes.ok) {
          html = await directRes.text();
        }
      } catch (err) {
        throw new Error('Unable to access Spotify embed. Please check your internet connection or verify the playlist is set to Public on Spotify.');
      }
    }

    if (!html) {
      throw new Error('Failed to load Spotify playlist content.');
    }

    // Extract __NEXT_DATA__ JSON from Spotify embed page
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      throw new Error('Could not parse Spotify playlist structure. The playlist might be private or region-restricted.');
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(nextDataMatch[1]);
    } catch {
      throw new Error('Corrupted playlist response from Spotify.');
    }

    const entity = parsedData?.props?.pageProps?.state?.data?.entity;
    if (!entity) {
      throw new Error('Playlist data entity was not found in Spotify response.');
    }

    const playlistTitle = entity.name || 'Imported Spotify Playlist';
    const playlistDesc = entity.description || 'Imported from Spotify to Spotibai';
    const coverUrl =
      entity.coverArt?.sources?.[0]?.url ||
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80';

    const rawTracks = entity.trackList || [];
    const tracks: Track[] = [];
    const trackIds: string[] = [];

    for (let i = 0; i < rawTracks.length; i++) {
      const item = rawTracks[i];
      const trackId = `spotify-${playlistId}-${i}-${Date.now()}`;
      const title = item.title || 'Unknown Title';
      const artist = item.subtitle || 'Unknown Artist';
      const duration = Math.round((item.duration || 180000) / 1000);

      const trackObj: Track = {
        id: trackId,
        title,
        artist,
        album: playlistTitle,
        duration,
        artworkUrl: coverUrl,
        audioUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
          `${title} ${artist}`
        )}`,
        sourceType: 'youtube',
        dateAdded: Date.now(),
      };

      tracks.push(trackObj);
      trackIds.push(trackId);
    }

    const playlist: Playlist = {
      id: `playlist-spotify-${playlistId}-${Date.now()}`,
      name: playlistTitle,
      description: playlistDesc,
      coverUrl,
      trackIds,
      isCustom: true,
      createdAt: Date.now(),
    };

    return { playlist, tracks };
  }
}

export const spotifyImporter = new SpotifyImporter();
