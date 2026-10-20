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

    // Clean query from Spotify metadata artifacts
    const cleanQuery = query
      .replace(/\s*-\s*(?:.*Remaster.*|Live|Mono|Stereo|Radio Edit|Bonus Track).*$/i, '')
      .replace(/\s*\((?:.*Remaster.*|Deluxe|Anniversary|Radio Edit|Single Version)[^)]*\)/gi, '')
      .replace(/\s*\[(?:.*Remaster.*|Explicit|Deluxe)[^\]]*\]/gi, '')
      .trim();

    // 1. Primary: YouTube InnerTube API (Fast & Direct)
    try {
      const response = await fetch('https://www.youtube.com/youtubei/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              videoId: candidates[0].vid,
              candidates: candidates.slice(0, 5).map((c) => c.vid),
            })
          );
          return;
        }

        // Fallback match in InnerTube if structure changes
        const str = JSON.stringify(data);
        const match = str.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (match && match[1]) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ videoId: match[1], candidates: [match[1]] }));
          return;
        }
      }
    } catch {
      // fallback
    }

    // 2. Secondary: Server-side Invidious instances
    const INVIDIOUS_INSTANCES = [
      'https://invidious.f5.si',
      'https://invidious.nerdvpn.de',
      'https://invidious.private.coffee',
      'https://iv.nboeck.de',
    ];

    for (const inst of INVIDIOUS_INSTANCES) {
      try {
        const invRes = await fetch(
          `${inst}/api/v1/search?q=${encodeURIComponent(cleanQuery)}&type=video`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (invRes.ok) {
          const invData = await invRes.json();
          if (Array.isArray(invData) && invData[0]?.videoId) {
            const alts = invData.slice(0, 4).map((d: any) => d.videoId);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ videoId: invData[0].videoId, candidates: alts }));
            return;
          }
        }
      } catch {
        // try next instance
      }
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'No video found', videoId: null, candidates: [] }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
  }
}
