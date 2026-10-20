import { LyricsLine, Track } from '../../types';

export class LyricsService {
  /**
   * Parses standard LRC timestamp strings like [01:23.45] into milliseconds and text
   */
  public parseLrc(lrcContent: string): LyricsLine[] {
    const lines = lrcContent.split('\n');
    const result: LyricsLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let match;
      const timestamps: number[] = [];
      let lastIndex = 0;

      while ((match = timeRegex.exec(line)) !== null) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const msStr = match[3] || '0';
        const ms = msStr.length === 2 ? parseInt(msStr, 10) * 10 : parseInt(msStr, 10);
        timestamps.push(mins * 60 * 1000 + secs * 1000 + ms);
        lastIndex = timeRegex.lastIndex;
      }

      const text = line.substring(lastIndex).trim();

      if (timestamps.length > 0 && text) {
        for (const timeMs of timestamps) {
          result.push({ timeMs, text });
        }
      }
    }

    const sorted = result.sort((a, b) => a.timeMs - b.timeMs);

    // Progressive Word-Level Timings for Apple Music Sing Karaoke
    for (let i = 0; i < sorted.length; i++) {
      const line = sorted[i];
      if (!line.words || line.words.length === 0) {
        // Check if line contains inline enhanced LRC word timestamps: <mm:ss.xx>
        const wordTagRegex = /<(\d{2}):(\d{2})(?:\.(\d{2,3}))?>([^<]+)/g;
        let wordMatch;
        const inlineWords: { text: string; timeMs: number }[] = [];

        while ((wordMatch = wordTagRegex.exec(line.text)) !== null) {
          const wMins = parseInt(wordMatch[1], 10);
          const wSecs = parseInt(wordMatch[2], 10);
          const wMsStr = wordMatch[3] || '0';
          const wMs = wMsStr.length === 2 ? parseInt(wMsStr, 10) * 10 : parseInt(wMsStr, 10);
          const wordTime = wMins * 60 * 1000 + wSecs * 1000 + wMs;
          inlineWords.push({
            text: wordMatch[4].trim(),
            timeMs: wordTime,
          });
        }

        if (inlineWords.length > 0) {
          line.words = inlineWords;
          line.text = inlineWords.map((w) => w.text).join(' ');
        } else {
          // Progressively distribute words across the line duration
          const rawWords = line.text.split(/\s+/).filter(Boolean);
          if (rawWords.length > 0) {
            const nextTime = i + 1 < sorted.length ? sorted[i + 1].timeMs : line.timeMs + 3500;
            const lineDuration = Math.max(800, nextTime - line.timeMs);
            const wordStep = lineDuration / rawWords.length;
            line.words = rawWords.map((word, wIdx) => ({
              text: word,
              timeMs: Math.round(line.timeMs + wIdx * wordStep),
            }));
          }
        }
      }
    }

    return sorted;
  }

  /**
   * Fetches synchronized lyrics from LRCLIB API, falling back to track-embedded lyrics
   */
  public async getLyricsForTrack(track: Track): Promise<LyricsLine[]> {
    // 1. Check if track already has embedded LRC lyrics
    if (track.lyrics) {
      const parsed = this.parseLrc(track.lyrics);
      if (parsed.length > 0) return parsed;
    }

    // 2. Fetch from LRCLIB public API
    try {
      const query = new URLSearchParams({
        track_name: track.title,
        artist_name: track.artist,
      });

      const response = await fetch(`https://lrclib.net/api/get?${query.toString()}`, {
        headers: {
          'User-Agent': 'Spotibai Music Player v1.0 (Web/PWA)',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.syncedLyrics) {
          return this.parseLrc(data.syncedLyrics);
        }
        if (data.plainLyrics) {
          // Approximate plain lyrics with evenly spaced timestamps
          const plainLines = data.plainLyrics.split('\n').filter((l: string) => l.trim().length > 0);
          const durationMs = (track.duration || 180) * 1000;
          const step = Math.floor(durationMs / Math.max(1, plainLines.length));
          return plainLines.map((line: string, idx: number) => ({
            timeMs: idx * step,
            text: line.trim(),
          }));
        }
      }
    } catch (err) {
      console.warn('LRCLIB lyrics fetch failed or offline:', err);
    }

    // 3. Fallback: Instrumental or default placeholder
    return [
      { timeMs: 0, text: `♪ ${track.title} - ${track.artist} ♪` },
      { timeMs: 3000, text: 'Enjoy the music...' },
      { timeMs: (track.duration ? track.duration * 500 : 30000), text: '♪ Instrumental vibes ♪' },
    ];
  }
}

export const lyricsService = new LyricsService();
