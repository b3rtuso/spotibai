export default async function handler(req: any, res: any) {
  // Set CORS headers for global web access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    let id: string | null = null;
    if (req.query && req.query.id) {
      id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    } else if (req.url) {
      const match = req.url.match(/playlist[/:]([a-zA-Z0-9]+)/) || req.url.match(/[?&]id=([a-zA-Z0-9]+)/);
      if (match) id = match[1];
    }

    if (!id) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing Spotify playlist ID' }));
      return;
    }

    const spotifyUrl = `https://open.spotify.com/embed/playlist/${id}`;
    const response = await fetch(spotifyUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Spotify embed request failed with status ${response.status}` }));
      return;
    }

    const html = await response.text();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
  }
}
