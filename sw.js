// Service worker: aplikacja działa offline, a obejrzane fragmenty mapy zostają w telefonie.
// Po zmianie plików podbij numer wersji.
const CACHE = 'mediaplan-v3';
const TILES = 'tiles-v1';
const MAX_TILES = 4000;
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png', './leaflet.js', './leaflet.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  if (keys.length > MAX_TILES) {
    await Promise.all(keys.slice(0, keys.length - MAX_TILES + 300).map(k => c.delete(k)));
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Kafelki mapy: najpierw z pamięci telefonu, potem z sieci (i zapis)
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(TILES).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { c.put(req, res.clone()); trimTiles(); }
        return res;
      })))
    );
    return;
  }

  // Pliki aplikacji
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(hit =>
        hit || fetch(req).then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => caches.match('./index.html'))
      )
    );
  }
});
