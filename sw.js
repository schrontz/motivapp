// Service Worker: App funktioniert auch bei wackeligem Netz.
// Strategie: erst Netz (damit Updates sofort ankommen), bei Fehler der letzte Stand aus dem Cache.
const CACHE = 'motivator-v7';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/views.js', './js/stats.js', './js/dates.js', './js/db.js', './js/icons.js', './js/config.js', './js/auto.js',
  './icons/icon.svg', './icons/icon-192.png'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' – am Browser-Cache vorbei, sonst landet eine bis zu 10 Min. alte Version von GitHub Pages im Cache
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const versionedCdn = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.gstatic.com';
  if (versionedCdn) {
    // feste Versionen: Cache zuerst
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    })));
    return;
  }
  if (!sameOrigin) return; // Supabase-Anfragen nie cachen
  e.respondWith(
    // no-cache: beim Server nachfragen, ob es eine neuere Version gibt (sonst liefert der Browser-Cache Altes)
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
