// Minimal service worker to enable PWA installability.
// Intentionally does not implement caching (yet) to avoid surprising behaviour
// during development and content iteration.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Passthrough.
  // Some environments (e.g. Codespaces forwarded ports) can redirect certain
  // requests (like webmanifest) to an auth domain, which then fails CORS.
  // Ensure those failures don't surface as unhandled promise rejections.
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('', { status: 504, statusText: 'Gateway Timeout' });
    })
  );
});
