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
              query,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const str = JSON.stringify(data);
            const match = str.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
            if (match && match[1]) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ videoId: match[1] }));
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
              const invRes = await fetch(`${inst}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
                signal: AbortSignal.timeout(3000),
              });
              if (invRes.ok) {
                const invData = await invRes.json();
                if (Array.isArray(invData) && invData[0]?.videoId) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ videoId: invData[0].videoId }));
                  return;
                }
              }
            } catch {}
          }

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ videoId: null }));
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
