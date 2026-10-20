import { Track, Artist, Album } from '../../types';

export interface SearchAllResult {
  artists: Artist[];
  tracks: Track[];
  albums: Album[];
}

function hashStringToNumber(str: string, min = 1000000, max = 80000000): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  return min + (positive % (max - min));
}

export class OnlineSearchService {
  /**
   * Transforms raw iTunes track object to Spotibai Track
   */
  private mapItunesTrack(item: any): Track {
    const highResArtwork = item.artworkUrl100
      ? item.artworkUrl100.replace('100x100bb', '600x600bb')
      : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80';

    const fullDuration = Math.round((item.trackTimeMillis || 210000) / 1000);

    return {
      id: `online-${item.trackId}`,
      title: item.trackName || 'Unknown Title',
      artist: item.artistName || 'Unknown Artist',
      album: item.collectionName || 'Single',
      duration: fullDuration,
      audioUrl: '',
      previewUrl: undefined,
      artworkUrl: highResArtwork,
      sourceType: 'youtube',
      genre: item.primaryGenreName || 'Pop',
      year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
      dateAdded: Date.now(),
    };
  }

  /**
   * Searches the global music universe across iTunes catalog and routes to YouTube for full-length songs
   */
  public async searchGlobalMusic(query: string): Promise<Track[]> {
    if (!query || query.trim().length < 2) return [];

    const tracks: Track[] = [];
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=30`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          for (const item of data.results) {
            tracks.push(this.mapItunesTrack(item));
          }
        }
      }
    } catch (err) {
      console.warn('iTunes song search error:', err);
    }

    return tracks;
  }

  /**
   * Searches for Artists matching the query and fetches their high-res portraits
   */
  public async searchArtists(query: string): Promise<Artist[]> {
    if (!query || query.trim().length < 2) return [];

    const artists: Artist[] = [];
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=musicArtist&limit=6`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          // Fetch top album artwork for each artist to serve as their high-res avatar
          const artistPromises = data.results.map(async (item: any) => {
            let avatarUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';
            try {
              const artLookup = await fetch(
                `https://itunes.apple.com/lookup?id=${item.artistId}&entity=album&limit=1`,
                { signal: AbortSignal.timeout(3500) }
              );
              if (artLookup.ok) {
                const artData = await artLookup.json();
                const album = artData.results?.find((r: any) => r.wrapperType === 'collection');
                if (album?.artworkUrl100) {
                  avatarUrl = album.artworkUrl100.replace('100x100bb', '600x600bb');
                }
              }
            } catch {
              // fallback avatar
            }

            const monthlyListeners = hashStringToNumber(item.artistName);

            return {
              id: String(item.artistId),
              name: item.artistName,
              avatarUrl,
              genre: item.primaryGenreName || 'Artist',
              followers: Math.round(monthlyListeners * 0.45),
              monthlyListeners,
            };
          });

          const resolved = await Promise.all(artistPromises);
          artists.push(...resolved);
        }
      }
    } catch (err) {
      console.warn('iTunes artist search error:', err);
    }

    return artists;
  }

  /**
   * Searches for Albums matching the query
   */
  public async searchAlbums(query: string): Promise<Album[]> {
    if (!query || query.trim().length < 2) return [];

    const albums: Album[] = [];
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          for (const item of data.results) {
            const coverUrl = item.artworkUrl100
              ? item.artworkUrl100.replace('100x100bb', '600x600bb')
              : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80';

            albums.push({
              id: String(item.collectionId),
              title: item.collectionName || 'Untitled Album',
              artist: item.artistName || 'Unknown Artist',
              artistId: item.artistId ? String(item.artistId) : undefined,
              coverUrl,
              releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
              trackCount: item.trackCount || 0,
              genre: item.primaryGenreName,
            });
          }
        }
      }
    } catch (err) {
      console.warn('iTunes album search error:', err);
    }

    return albums;
  }

  /**
   * Searches the decentralized Audius catalog for 100% full-length, streamable, and downloadable tracks
   */
  public async searchAudiusMusic(query: string): Promise<Track[]> {
    if (!query || query.trim().length < 2) return [];

    const tracks: Track[] = [];
    try {
      const res = await fetch(
        `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=SPOTIBAI`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          for (const item of json.data.slice(0, 15)) {
            const streamUrl = `https://discoveryprovider.audius.co/v1/tracks/${item.id}/stream?app_name=SPOTIBAI`;
            const artwork =
              item.artwork?.['480x480'] ||
              item.artwork?.['1000x1000'] ||
              item.artwork?.['150x150'] ||
              'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';

            tracks.push({
              id: `audius-${item.id}`,
              title: item.title || 'Unknown Title',
              artist: item.user?.name || 'Open Artist',
              album: item.genre ? `${item.genre} Edition` : 'Audius Release',
              duration: Math.round(item.duration || 180),
              audioUrl: streamUrl,
              previewUrl: streamUrl,
              artworkUrl: artwork,
              sourceType: 'online',
              genre: item.genre || 'Indie',
              year: item.release_date ? new Date(item.release_date).getFullYear() : undefined,
              dateAdded: Date.now(),
            });
          }
        }
      }
    } catch (err) {
      console.warn('Audius search error:', err);
    }

    return tracks;
  }

  /**
   * Unified search: returns Artists, Songs, and Albums all together
   */
  public async searchAll(query: string): Promise<SearchAllResult> {
    if (!query || query.trim().length < 2) {
      return { artists: [], tracks: [], albums: [] };
    }

    const [artists, tracks, albums, audiusTracks] = await Promise.all([
      this.searchArtists(query),
      this.searchGlobalMusic(query),
      this.searchAlbums(query),
      this.searchAudiusMusic(query),
    ]);

    // Combined catalog: iTunes top matches + Audius open full-length tracks
    const combinedTracks = [...tracks, ...audiusTracks];

    return { artists, tracks: combinedTracks, albums };
  }

  /**
   * Gets complete artist profile, popular songs, and full discography albums
   */
  public async getArtistDetails(artistNameOrId: string): Promise<{
    artist: Artist;
    topTracks: Track[];
    albums: Album[];
  }> {
    const isNumericId = /^\d+$/.test(artistNameOrId.trim());
    let artistId = isNumericId ? artistNameOrId.trim() : null;
    let artistName = isNumericId ? '' : artistNameOrId.trim();
    let artistGenre = 'Music';

    // 1. Resolve artist ID if only name was provided
    if (!artistId) {
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.results?.[0]) {
            artistId = String(data.results[0].artistId);
            artistName = data.results[0].artistName;
            artistGenre = data.results[0].primaryGenreName || 'Pop';
          }
        }
      } catch (err) {
        console.warn('Failed to resolve artist ID:', err);
      }
    }

    let topTracks: Track[] = [];
    let albums: Album[] = [];
    let avatarUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';

    if (artistId) {
      // 2. Fetch artist top songs & albums by artistId
      try {
        const [songsRes, albumsRes] = await Promise.all([
          fetch(`https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=15`),
          fetch(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=30`),
        ]);

        if (songsRes.ok) {
          const songsData = await songsRes.json();
          if (songsData.results && Array.isArray(songsData.results)) {
            const songItems = songsData.results.filter((r: any) => r.wrapperType === 'track');
            topTracks = songItems.map((item: any) => this.mapItunesTrack(item));
            if (!artistName && songsData.results[0]?.artistName) {
              artistName = songsData.results[0].artistName;
            }
          }
        }

        if (albumsRes.ok) {
          const albumsData = await albumsRes.json();
          if (albumsData.results && Array.isArray(albumsData.results)) {
            const albumItems = albumsData.results.filter((r: any) => r.wrapperType === 'collection');
            albums = albumItems.map((item: any) => ({
              id: String(item.collectionId),
              title: item.collectionName || 'Untitled Album',
              artist: item.artistName || artistName,
              artistId: String(item.artistId),
              coverUrl: item.artworkUrl100
                ? item.artworkUrl100.replace('100x100bb', '600x600bb')
                : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
              releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
              trackCount: item.trackCount || 0,
              genre: item.primaryGenreName,
            }));

            // Use the latest/top album artwork for the artist's high-res avatar
            if (albums[0]?.coverUrl) {
              avatarUrl = albums[0].coverUrl;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to lookup artist songs/albums by ID:', err);
      }
    }

    // Fallback: If lookup produced no tracks, search directly by artist name
    if (topTracks.length === 0 && artistName) {
      topTracks = await this.searchGlobalMusic(artistName);
      if (topTracks.length > 0 && topTracks[0].artworkUrl) {
        avatarUrl = topTracks[0].artworkUrl;
      }
    }
    if (albums.length === 0 && artistName) {
      albums = await this.searchAlbums(artistName);
      if (albums.length > 0 && !avatarUrl) {
        avatarUrl = albums[0].coverUrl;
      }
    }

    const monthlyListeners = hashStringToNumber(artistName || 'Artist');

    const artist: Artist = {
      id: artistId || `artist-${artistName.toLowerCase().replace(/\s+/g, '-')}`,
      name: artistName || 'Unknown Artist',
      avatarUrl,
      genre: artistGenre,
      followers: Math.round(monthlyListeners * 0.45),
      monthlyListeners,
      bio: `Official artist profile for ${artistName}. Listen to popular tracks, complete discography albums, and singles on Spotibai.`,
    };

    return { artist, topTracks, albums };
  }

  /**
   * Gets complete Album details along with all tracks inside the album
   */
  public async getAlbumDetails(albumId: string): Promise<{
    album: Album;
    tracks: Track[];
  }> {
    let album: Album = {
      id: albumId,
      title: 'Album',
      artist: 'Artist',
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
      trackCount: 0,
    };
    const tracks: Track[] = [];

    try {
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${albumId}&entity=song`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          const collection = data.results.find((r: any) => r.wrapperType === 'collection');
          if (collection) {
            album = {
              id: String(collection.collectionId),
              title: collection.collectionName,
              artist: collection.artistName,
              artistId: collection.artistId ? String(collection.artistId) : undefined,
              coverUrl: collection.artworkUrl100
                ? collection.artworkUrl100.replace('100x100bb', '600x600bb')
                : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
              releaseYear: collection.releaseDate
                ? new Date(collection.releaseDate).getFullYear()
                : undefined,
              trackCount: collection.trackCount || 0,
              genre: collection.primaryGenreName,
            };
          }

          const songItems = data.results.filter((r: any) => r.wrapperType === 'track');
          for (const item of songItems) {
            tracks.push(this.mapItunesTrack(item));
          }
        }
      }
    } catch (err) {
      console.warn('Failed to lookup album tracks:', err);
    }

    return { album, tracks };
  }
}

export const onlineSearchService = new OnlineSearchService();
