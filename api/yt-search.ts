export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    let query: string | null = null;
    if (req.query && req.query.q) {
      query = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
    } else if (req.url) {
      const url = new URL(req.url, 'http://localhost');
      query = url.searchParams.get('q');
    }

    if (!query) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing query parameter q' }));
      return;
    }

    // 1. Primary: YouTube InnerTube API (Fast & Direct)
    try {
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
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ videoId: match[1] }));
          return;
        }
      }
    } catch {
      // fallback
    }

    // 2. Secondary: Server-side Invidious instances (server-to-server has NO browser CORS restrictions)
    const INVIDIOUS_INSTANCES = [
      'https://invidious.f5.si',
      'https://invidious.nerdvpn.de',
      'https://invidious.private.coffee',
      'https://iv.nboeck.de',
    ];

    for (const inst of INVIDIOUS_INSTANCES) {
      try {
        const invRes = await fetch(
          `${inst}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (invRes.ok) {
          const invData = await invRes.json();
          if (Array.isArray(invData) && invData[0]?.videoId) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ videoId: invData[0].videoId }));
            return;
          }
        }
      } catch {
        // try next instance
      }
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'No video found', videoId: null }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
  }
}
