// Minimal service worker for Shukatsu Manager.
//
// Strategy: installable PWA shell only.
// - No caching of business/API data (Convex, Clerk, PostHog).
// - No offline experience, offline CRUD, or background sync.
// - Every request passes through to the network, so a newly deployed version
//   is picked up on the next load without forcing a mid-session reload.

const CACHE_NAME = 'shukatsu-manager-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
