// Service Worker: App funktioniert auch bei wackeligem Netz.
// Strategie: erst Netz (damit Updates sofort ankommen), bei Fehler der letzte Stand aus dem Cache.
const CACHE = 'motivator-v25';
const SHARE = 'motivator-share'; // geteilte Dateien, bis die App sie abholt
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/core.js', './js/views.js', './js/stats.js', './js/dates.js', './js/db.js', './js/icons.js',
  './js/config.js', './js/auto.js', './js/strength.js', './js/body.js', './js/distance.js', './js/map.js', './js/actions/body.js', './js/actions/distance.js',
  './js/actions/habits.js', './js/actions/imports.js', './js/actions/profile.js', './js/actions/strength.js',
  './js/actions/withings.js', './js/views/body.js', './js/views/distance.js', './js/views/habits.js', './js/views/imports.js',
  './js/views/overview.js', './js/views/profile.js', './js/views/strength.js', './js/views/training.js',
  './js/views/ui.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' – am Browser-Cache vorbei, sonst landet eine bis zu 10 Min. alte Version von GitHub Pages im Cache
  // Einzeln und fehlertolerant: Ein wackeliger Abruf darf die Installation nicht scheitern lassen
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// „Teilen → Motivator“ (z. B. CSV aus Alpha Progression): Datei zwischenlagern und die App öffnen
async function receiveShare(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const text = form.get('text');
    const body = file && typeof file !== 'string' ? file : (typeof text === 'string' && text.includes(';') ? text : null);
    if (body) {
      const cache = await caches.open(SHARE);
      await cache.put(new URL('./shared-file', self.location).href, new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Name': encodeURIComponent((file && file.name) || '') }
      }));
    }
  } catch (err) {
    // nichts zu holen – die App zeigt dann einfach die Dateiauswahl
  }
  return Response.redirect(new URL('./#/import/shared', self.location).href, 303);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith(receiveShare(req));
    return;
  }
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
