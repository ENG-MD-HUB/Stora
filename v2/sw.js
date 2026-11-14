/* STORA service worker — keeps the app shell available offline.
   Firestore data itself is cached by Firestore's own offline persistence. */
const VERSION = "stora-v2.1";
const SHELL = ["/Stora/v2/", "/Stora/v2/index.html", "/Stora/v2/manifest.webmanifest", "/Stora/v2/favicon.png", "/Stora/v2/icon-192.png", "/Stora/v2/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameApp = url.origin === self.location.origin && url.pathname.startsWith("/Stora/v2/");
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameApp && !fonts) return; // never touch Firebase / Firestore traffic

  if (fonts) {
    // cache-first for fonts
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // network-first for the app, fall back to cache when offline
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("/Stora/v2/index.html") : Response.error())))
  );
});
