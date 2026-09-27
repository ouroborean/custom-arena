// The service worker (docs/live-ops.md §6): installable app, and an offline shell for the sandbox.
// A template: the build (vite.config.ts) fills in this build's files and version and emits /sw.js.
//
// - The app shell (index.html, the hashed bundles, icons) is precached per build.
// - Pages are network-first, so an online client always loads the build its server is running
//   (online play needs matching content); offline, the cached shell starts and the client falls
//   back to its Offline screen and local sandbox.
// - The API is never cached: the server is the source of truth for accounts, rewards and matches.
// - Everything else (fonts, portrait and sound files, asset manifests) is stale-while-revalidate.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = `arena-shell-${VERSION}`;
const RUNTIME = 'arena-runtime';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('arena-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirstPage(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match('/', { cacheName: SHELL })) ?? Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(event.request);
  const fresh = fetch(event.request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') void cache.put(event.request, response.clone());
      return response;
    })
    .catch(() => cached ?? Response.error());
  if (cached) {
    event.waitUntil(fresh);
    return cached;
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') return event.respondWith(networkFirstPage(request));
  if (sameOrigin && PRECACHE.includes(url.pathname)) {
    return event.respondWith(caches.match(url.pathname, { cacheName: SHELL }).then((hit) => hit ?? fetch(request)));
  }
  if (url.protocol.startsWith('http')) event.respondWith(staleWhileRevalidate(event));
});
