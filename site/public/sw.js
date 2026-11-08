const CACHE = 'hand-v2';
const SHELL = ['/fonts/fonts.css', '/fonts/google-sans-flex.woff2', '/brand/favicon.svg', '/brand/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const skip = (url) => url.origin !== self.location.origin || self.location.hostname !== 'hand.coey.dev' || url.pathname.startsWith('/oauth/') || url.pathname.endsWith('.mp4');

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || skip(url)) return;
  const immutable = ['/assets/', '/fonts/', '/brand/'].some((prefix) => url.pathname.startsWith(prefix));
  if (!immutable) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? (request.mode === 'navigate' ? caches.match('/') : Response.error()))),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
