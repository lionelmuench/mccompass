// Tiny offline cache
const CACHE = 'mccompass-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './geo.js',
  './sensors.js',
  './data.js',
  './pwa.js',
  './vendor/papaparse.min.js',
  './assets/arrow.svg',
  './manifest.webmanifest',
  './mcdonalds.csv', // cached after first visit
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Stale-while-revalidate for all GET requests
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then(networkRes => {
      if (networkRes && networkRes.ok) cache.put(req, networkRes.clone());
      return networkRes;
    }).catch(()=>cached);
    return cached || fetchPromise;
  })());
});
