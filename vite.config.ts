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
            headers: { 'Content-Type': 'application/json' },
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

          if (!response.ok) {
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'YouTube search failed' }));
            return;
          }

          const data = await response.json();
          const str = JSON.stringify(data);
          const match = str.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
          const videoId = match ? match[1] : null;

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ videoId }));
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
