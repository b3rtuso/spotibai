import { Track } from '../../types';
import { db } from '../db/database';
import { onlineSearchService } from '../api/onlineSearchService';

export class AutoplayEngine {
  /**
   * Generates Spotify-style algorithmic recommendations when a track or queue finishes.
   * Uses multi-factor scoring: Genre clustering, Artist affinity, Liked-song weights,
   * while heavily penalizing tracks recently played in history to ensure high variety.
   */
  public async getNextRecommendations(
    currentTrack: Track,
    currentQueue: Track[],
    recentHistoryIds: string[] = [],
    count = 5
  ): Promise<Track[]> {
    // 1. Gather candidate pool from IndexedDB
    const allDbTracks = await db.tracks.toArray();

    // Set of IDs currently in queue or recently played to avoid repetitive loops
    const queueIds = new Set(currentQueue.map((t) => t.id));
    const historyIds = new Set(recentHistoryIds.slice(-15)); // last 15 tracks

    // 2. Score each candidate track
    const scoredCandidates: { track: Track; score: number }[] = [];

    for (const track of allDbTracks) {
      if (track.id === currentTrack.id) continue;

      let score = 0;

      // Heavy penalty if already in the active queue or played in last 15 songs
      if (queueIds.has(track.id)) score -= 100;
      if (historyIds.has(track.id)) score -= 80;

      // Factor 1: Genre clustering (+40 points for exact match, +20 for related)
      if (currentTrack.genre && track.genre) {
        if (currentTrack.genre.toLowerCase() === track.genre.toLowerCase()) {
          score += 45;
        } else if (
          this.areGenresRelated(currentTrack.genre, track.genre)
        ) {
          score += 25;
        }
      }

      // Factor 2: Artist affinity (+35 points for same artist)
      if (
        currentTrack.artist &&
        track.artist &&
        currentTrack.artist.toLowerCase() === track.artist.toLowerCase()
      ) {
        score += 35;
      }

      // Factor 3: Liked song bias (+25 points)
      if (track.isLiked) {
        score += 25;
      }

      // Factor 4: Release era proximity (+10 points if within 5 years)
      if (currentTrack.year && track.year) {
        const yearDiff = Math.abs(currentTrack.year - track.year);
        if (yearDiff <= 5) score += 10;
        else if (yearDiff <= 10) score += 5;
      }

      // Factor 5: Non-deterministic jitter (+0-10 points) for natural Spotify discovery variance
      score += Math.random() * 10;

      scoredCandidates.push({ track, score });
    }

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Pick top candidates with positive score
    let recommendations = scoredCandidates
      .filter((c) => c.score > -50)
      .slice(0, count)
      .map((c) => c.track);

    // 3. Global Discovery Fallback: If library candidates are sparse, fetch similar songs via iTunes/YouTube search
    if (recommendations.length < count) {
      try {
        const searchQuery = currentTrack.genre || currentTrack.artist || 'Top Hits';
        const globalResults = await onlineSearchService.searchGlobalMusic(searchQuery);

        for (const globalTrack of globalResults) {
          if (
            globalTrack.id !== currentTrack.id &&
            !queueIds.has(globalTrack.id) &&
            !recommendations.some((r) => r.id === globalTrack.id)
          ) {
            recommendations.push(globalTrack);
            if (recommendations.length >= count) break;
          }
        }
      } catch (err) {
        console.warn('Autoplay global discovery error:', err);
      }
    }

    return recommendations;
  }

  private areGenresRelated(g1: string, g2: string): boolean {
    const s1 = g1.toLowerCase();
    const s2 = g2.toLowerCase();
    if (s1.includes('electronic') && (s2.includes('synth') || s2.includes('house') || s2.includes('dance'))) return true;
    if (s1.includes('synth') && (s2.includes('electronic') || s2.includes('cyber') || s2.includes('retro'))) return true;
    if (s1.includes('lo-fi') && (s2.includes('chill') || s2.includes('hip-hop') || s2.includes('study'))) return true;
    if (s1.includes('chill') && (s2.includes('lo-fi') || s2.includes('ambient') || s2.includes('acoustic'))) return true;
    if (s1.includes('pop') && (s2.includes('dance') || s2.includes('electronic') || s2.includes('indie'))) return true;
    return false;
  }
}

export const autoplayEngine = new AutoplayEngine();
