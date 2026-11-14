/* Retired beta service worker: removes itself and sends open pages to /Stora/. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('stora-3.0.0-beta')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach((c) => c.navigate('/Stora/' + new URL(c.url).hash));
  })());
});
