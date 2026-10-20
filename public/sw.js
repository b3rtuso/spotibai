const CACHE_NAME = 'spotibai-cache-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Only handle local same-origin static assets
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Bypass API and proxy routes
  if (e.request.url.includes('/api/')) {
    return;
  }

  // Never intercept media, audio, video, or range requests (browsers handle HTTP 206 natively)
  if (
    e.request.destination === 'audio' ||
    e.request.destination === 'video' ||
    e.request.headers.has('range') ||
    e.request.url.includes('/audio/') ||
    /\.(mp3|ogg|wav|m4a|aac)(\?.*)?$/i.test(e.request.url)
  ) {
    return;
  }

  e.respondWith(
    fetch(e.request).catch(async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      return new Response('', { status: 404, statusText: 'Not Found' });
    })
  );
});
