// Arrowfall offline cache: the page is network-first (updates land on the next load),
// hashed build files are cache-first, and art is served from cache while it refreshes.
const CACHE = 'arrowfall-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const request = e.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((c) => c.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  const hashed = new URL(request.url).pathname.startsWith('/assets/');
  e.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      });
      if (hit && !hashed) fresh.catch(() => {});
      return hit && hashed ? hit : hit || fresh;
    }),
  );
});
