import { Track } from '../../types';

const API_BASE = (import.meta.env.VITE_KARAOKE_API_URL || '').replace(/\/$/, '');

export interface KaraokeStems {
  trackId: string;
  vocalsUrl: string;
  instrumentalUrl: string;
  cached: boolean;
}

export class KaraokeService {
  private stemsCache = new Map<string, KaraokeStems>();

  /**
   * Checks if separated stems already exist in memory or backend cache
   */
  public async getStems(trackId: string): Promise<KaraokeStems | null> {
    if (this.stemsCache.has(trackId)) {
      return this.stemsCache.get(trackId)!;
    }

    try {
      const res = await fetch(`${API_BASE}/api/karaoke/status/${encodeURIComponent(trackId)}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ready && data.vocals && data.instrumental) {
          const resolveUrl = (url: string) => url.startsWith('http') ? url : `${API_BASE}${url}`;
          const stems: KaraokeStems = {
            trackId,
            vocalsUrl: resolveUrl(data.vocals),
            instrumentalUrl: resolveUrl(data.instrumental),
            cached: true,
          };
          this.stemsCache.set(trackId, stems);
          return stems;
        }
      }
    } catch {
      // Backend not running or timeout - proceed to fallback/direct flow
    }

    return null;
  }

  /**
   * Sends audio to Demucs AI separation backend and receives vocals + instrumental stems
   */
  public async separateTrack(
    track: Track,
    onProgress?: (status: string) => void
  ): Promise<KaraokeStems> {
    // 1. Check cache first
    const cached = await this.getStems(track.id);
    if (cached) {
      if (onProgress) onProgress('Karaoke Ready ✓');
      return cached;
    }

    if (onProgress) onProgress('Preparing Karaoke Mode...');

    // 2. Prepare payload (audio blob or URL)
    const formData = new FormData();
    formData.append('trackId', track.id);
    formData.append('title', track.title || 'Unknown');
    formData.append('artist', track.artist || 'Unknown');

    if (track.audioBlob) {
      formData.append('file', track.audioBlob, `${track.id}.mp3`);
    } else if (track.audioUrl) {
      formData.append('audioUrl', track.audioUrl);
    }

    if (onProgress) onProgress('Separating vocals from instrumental with Demucs AI...');

    try {
      const res = await fetch(`${API_BASE}/api/karaoke/separate`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120000), // Demucs separation can take 15-45s depending on track length
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      if (!data.vocals || !data.instrumental) {
        throw new Error('Invalid stem response from separation backend');
      }

      const resolveUrl = (url: string) => url.startsWith('http') ? url : `${API_BASE}${url}`;
      const stems: KaraokeStems = {
        trackId: track.id,
        vocalsUrl: resolveUrl(data.vocals),
        instrumentalUrl: resolveUrl(data.instrumental),
        cached: Boolean(data.cached),
      };

      this.stemsCache.set(track.id, stems);
      if (onProgress) onProgress('Karaoke Ready ✓');
      return stems;
    } catch (err: any) {
      console.warn('Demucs separation backend notice:', err);
      throw err;
    }
  }

  /**
   * Helper that checks if stems exist for a track and returns simple url map
   */
  public async getStemUrls(track: Track): Promise<{ vocals: string; instrumental: string } | null> {
    if (track.karaokeStems?.vocalsUrl && track.karaokeStems?.instrumentalUrl) {
      return {
        vocals: track.karaokeStems.vocalsUrl,
        instrumental: track.karaokeStems.instrumentalUrl,
      };
    }
    try {
      const stems = await this.getStems(track.id);
      if (stems) {
        return {
          vocals: stems.vocalsUrl,
          instrumental: stems.instrumentalUrl,
        };
      }
    } catch {
      return null;
    }
    return null;
  }
}

export const karaokeService = new KaraokeService();
