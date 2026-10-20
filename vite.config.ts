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
              query: cleanQuery.toLowerCase().includes('audio') || cleanQuery.toLowerCase().includes('official')
                ? cleanQuery
                : `${cleanQuery} official audio`,
            }),
          });

          if (response.ok) {
            const data: any = await response.json();
            const candidates: Array<{ vid: string; title: string; channel: string; score: number }> = [];

            const sections =
              data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
            for (const sec of sections) {
              const items = sec?.itemSectionRenderer?.contents || [];
              for (const item of items) {
                if (item.videoRenderer && item.videoRenderer.videoId) {
                  const vid = item.videoRenderer.videoId;
                  const vTitle = item.videoRenderer.title?.runs?.[0]?.text || '';
                  const channel = item.videoRenderer.ownerText?.runs?.[0]?.text || '';

                  const lowerTitle = vTitle.toLowerCase();
                  const lowerChannel = channel.toLowerCase();
                  const lowerQuery = cleanQuery.toLowerCase();

                  let score = 0;
                  const queryWords = lowerQuery
                    .split(/\s+/)
                    .filter((w) => w.length > 2 && w !== 'audio' && w !== 'official');
                  for (const word of queryWords) {
                    if (lowerTitle.includes(word)) score += 3;
                    if (lowerChannel.includes(word)) score += 2;
                  }

                  if (lowerTitle.includes('official') || lowerTitle.includes('audio') || lowerChannel.includes('topic')) {
                    score += 5;
                  }
                  if (lowerTitle.includes('cover') && !lowerQuery.includes('cover')) score -= 15;
                  if (lowerTitle.includes('karaoke') || lowerTitle.includes('instrumental')) score -= 10;
                  if (lowerTitle.includes('remix') && !lowerQuery.includes('remix')) score -= 8;
                  if (lowerTitle.includes('parody') || lowerTitle.includes('reaction') || lowerTitle.includes('review')) {
                    score -= 20;
                  }

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
              const invRes = await fetch(`${inst}/api/v1/search?q=${encodeURIComponent(cleanQuery)}&type=video`, {
                signal: AbortSignal.timeout(3000),
              });
              if (invRes.ok) {
                const invData = await invRes.json();
                if (Array.isArray(invData) && invData[0]?.videoId) {
                  const alts = invData.slice(0, 4).map((d: any) => d.videoId);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ videoId: invData[0].videoId, candidates: alts }));
                  return;
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
