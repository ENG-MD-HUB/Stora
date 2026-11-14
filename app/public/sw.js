/* STORA 3 service worker: app shell offline (Firestore caches data itself). */
const VERSION = 'stora-3.0.1';
const SCOPE = '/Stora/';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll([SCOPE, SCOPE + 'index.html'])).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // /Stora/v2/ (archived 2.x) and /Stora/beta/ (old link) are left alone.
  const app = u.origin === location.origin && u.pathname.startsWith('/Stora/') && !u.pathname.startsWith('/Stora/v2/') && !u.pathname.startsWith('/Stora/beta/');
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (!app && !font) return;
  if (font || u.pathname.includes('/assets/')) {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then((x) => x.put(r, c)); } return res; })));
    return;
  }
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then((x) => x.put(r, c)); } return res; })
    .catch(() => caches.match(r).then((hit) => hit || caches.match(SCOPE + 'index.html'))));
});
