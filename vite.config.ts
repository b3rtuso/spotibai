import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function youtubeResolverPlugin() {
  return {
    name: 'youtube-resolver',
    configureServer(server: any) {
      server.middlewares.use('/api/yt-search', async (req: any, res: any) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const query = url.searchParams.get('q');
          if (!query) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing query parameter q' }));
            return;
          }

          // Clean query from Spotify metadata artifacts
          const cleanQuery = query
            .replace(/\s*-\s*(?:.*Remaster.*|Live|Mono|Stereo|Radio Edit|Bonus Track).*$/i, '')
            .replace(/\s*\((?:.*Remaster.*|Deluxe|Anniversary|Radio Edit|Single Version)[^)]*\)/gi, '')
            .replace(/\s*\[(?:.*Remaster.*|Explicit|Deluxe)[^\]]*\]/gi, '')
            .trim();

          const response = await fetch('https://www.youtube.com/youtubei/v1/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: 'WEB',
                  clientVersion: '2.20240101.01.00',
                  hl: 'en',
                  gl: 'US',
                },
              },
              query: cleanQuery.toLowerCase().includes('audio')
                ? cleanQuery
                : `${cleanQuery} audio`,
            }),
          });

          if (response.ok) {
            const data: any = await response.json();
            const candidates: Array<{ vid: string; title: string; channel: string; score: number }> = [];

            // Parse artist and title from cleanQuery ("Artist - Title")
            let artistPart = '';
            let titlePart = cleanQuery.toLowerCase();
            if (cleanQuery.includes(' - ')) {
              const parts = cleanQuery.split(' - ');
              artistPart = parts[0].trim().toLowerCase();
              titlePart = parts.slice(1).join(' - ').trim().toLowerCase();
            }

            const sections =
              data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
            for (const sec of sections) {
              const items = sec?.itemSectionRenderer?.contents || [];
              for (const item of items) {
                if (item.videoRenderer && item.videoRenderer.videoId) {
                  const vid = item.videoRenderer.videoId;
                  const vTitle = item.videoRenderer.title?.runs?.[0]?.text || '';
                  const channel = item.videoRenderer.ownerText?.runs?.[0]?.text || '';
                  const snippetStr = JSON.stringify(item.videoRenderer.detailedMetadataSnippets || '').toLowerCase();

                  const lowerTitle = vTitle.toLowerCase();
                  const lowerChannel = channel.toLowerCase();
                  const lowerQuery = cleanQuery.toLowerCase();

                  let score = 0;

                  // Title matching - highest priority
                  if (titlePart) {
                    if (lowerTitle.includes(titlePart)) {
                      score += 35;
                    } else {
                      const tWords = titlePart.split(/\s+/).filter((w) => w.length > 1);
                      let matchCount = 0;
                      for (const w of tWords) {
                        if (lowerTitle.includes(w)) matchCount++;
                      }
                      if (tWords.length > 0 && matchCount === tWords.length) {
                        score += 25;
                      } else if (matchCount > 0) {
                        score += matchCount * 5;
                      } else {
                        score -= 40;
                      }
                    }
                  }

                  // Artist matching: reward each matched artist word
                  if (artistPart) {
                    const aWords = artistPart.split(/[,&]+|\s+/).map((w) => w.trim()).filter((w) => w.length > 2);
                    let aMatch = 0;
                    for (const w of aWords) {
                      if (lowerTitle.includes(w) || lowerChannel.includes(w)) {
                        aMatch++;
                        score += 6;
                      }
                    }
                    if (aMatch === 0) {
                      score -= 30;
                    }
                  }

                  // 1. YouTube Music / Label Delivery (100% Studio Audio)
                  const isProvided = snippetStr.includes('provided to youtube') || snippetStr.includes('auto-generated');
                  if (isProvided) {
                    score += 30;
                  }
                  if (lowerChannel.endsWith('- topic') || lowerChannel.includes('topic')) {
                    score += 25;
                  }

                  // 2. Pure Audio indicators
                  const isAudio = /official audio|\(audio\)|\[audio\]|\baudio\b/i.test(vTitle);
                  if (isAudio) {
                    score += 20;
                  }

                  // 3. Lyrics (Uses exact studio track, zero MV dialogue/acting)
                  const isLyric = /official lyric video|\(lyrics\)|\blyrics\b|\blyric\b/i.test(vTitle);
                  if (isLyric) {
                    score += 15;
                  }

                  // 4. PENALIZE MV (Music Video) & Film cuts strictly (user requirement: use actual songs and not the mv one)
                  const isMV =
                    /\b(music video|official (?:4k\s*|hd\s*)?video|m\/?v|short film|film|trailer|teaser)\b/i.test(vTitle) ||
                    /\((?:official\s+)?video\)/i.test(vTitle) ||
                    /\[(?:official\s+)?video\]/i.test(vTitle) ||
                    /\((?:official\s+)?mv\)/i.test(vTitle) ||
                    /\[(?:official\s+)?mv\]/i.test(vTitle);
                  if (isMV) {
                    score -= 45;
                  }

                  // If title has generic 'video' without 'audio' or 'lyric'
                  if (lowerTitle.includes('video') && !isAudio && !isLyric) {
                    score -= 25;
                  }

                  // 5. Penalties for partial cuts, loops, slowed, covers, live, etc.
                  if (/\b(only|without|part|cut|verse)\b/i.test(vTitle)) score -= 30;
                  if (/\b(1\s*hour|10\s*hours|loop|extended\s*mix)\b/i.test(vTitle)) score -= 30;
                  if (lowerTitle.includes('cover') && !lowerQuery.includes('cover')) score -= 30;
                  if (lowerTitle.includes('parody') || lowerTitle.includes('reaction') || lowerTitle.includes('review')) score -= 40;
                  if (lowerTitle.includes('live') && !lowerQuery.includes('live')) score -= 25;
                  if (lowerTitle.includes('karaoke') || lowerTitle.includes('instrumental')) score -= 20;
                  if (lowerTitle.includes('remix') && !lowerQuery.includes('remix')) score -= 15;
                  if (/\b(slowed|reverb|sped up|speed up|nightcore|8d|bass boosted|extravaganza|mashup)\b/i.test(vTitle)) score -= 30;

                  candidates.push({ vid, title: vTitle, channel, score });
                }
              }
            }

            if (candidates.length > 0) {
              candidates.sort((a, b) => b.score - a.score);
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  videoId: candidates[0].vid,
                  candidates: candidates.slice(0, 5).map((c) => c.vid),
                })
              );
              return;
            }

            const str = JSON.stringify(data);
            const match = str.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
            if (match && match[1]) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ videoId: match[1], candidates: [match[1]] }));
              return;
            }
          }

          // Fallback to Invidious server-side
          const INVIDIOUS = [
            'https://invidious.f5.si',
            'https://invidious.nerdvpn.de',
            'https://invidious.private.coffee',
            'https://iv.nboeck.de',
          ];
          for (const inst of INVIDIOUS) {
            try {
              const invQuery = cleanQuery.toLowerCase().includes('audio') ? cleanQuery : `${cleanQuery} audio`;
              const invRes = await fetch(`${inst}/api/v1/search?q=${encodeURIComponent(invQuery)}&type=video`, {
                signal: AbortSignal.timeout(3000),
              });
              if (invRes.ok) {
                const invData = await invRes.json();
                if (Array.isArray(invData)) {
                  const nonMvCandidates = invData
                    .filter((d: any) => d && d.videoId)
                    .sort((a: any, b: any) => {
                      const aMv = /\b(music video|official (?:4k\s*|hd\s*)?video|mv)\b/i.test(a.title || '');
                      const bMv = /\b(music video|official (?:4k\s*|hd\s*)?video|mv)\b/i.test(b.title || '');
                      if (aMv && !bMv) return 1;
                      if (!aMv && bMv) return -1;
                      return 0;
                    });

                  if (nonMvCandidates.length > 0) {
                    const alts = nonMvCandidates.slice(0, 5).map((d: any) => d.videoId);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ videoId: nonMvCandidates[0].videoId, candidates: alts }));
                    return;
                  }
                }
              }
            } catch {}
          }

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ videoId: null, candidates: [] }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
        }
      });

      server.middlewares.use('/api/spotify-embed', async (req: any, res: any) => {
        try {
          let id: string | null = null;
          const url = new URL(req.url, 'http://localhost');
          if (url.searchParams.get('id')) {
            id = url.searchParams.get('id');
          } else {
            const m = req.url.match(/playlist[/:]([a-zA-Z0-9]+)/);
            if (m) id = m[1];
          }

          if (!id) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing Spotify playlist ID' }));
            return;
          }

          const response = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });

          if (!response.ok) {
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to fetch Spotify embed' }));
            return;
          }

          const html = await response.text();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), youtubeResolverPlugin()],
  server: {
    proxy: {
      '/api/karaoke': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/stems': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/spotify-embed': {
        target: 'https://open.spotify.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spotify-embed/, '/embed'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
    },
  },
})
