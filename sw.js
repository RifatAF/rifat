// Код и тексты всегда свежие (сначала сеть), тяжелые файлы из кэша (модель, голос, картинки, 3D).
const V = 'bp-v48';
const HEAVY = /\/(models|voice|img)\/|body3d\.bin|cdn\.jsdelivr\.net|fonts\.(gstatic|googleapis)\.com/;
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
  // чужие адреса (вход Google, Telegram) браузер грузит сам, мимо кэша
  if (!e.request.url.startsWith(self.location.origin) && !HEAVY.test(e.request.url)) return;
  const heavy = HEAVY.test(e.request.url) && !e.request.url.includes('index.json'); // список фраз всегда свежий
  e.respondWith(caches.open(V).then(async c => {
    if (heavy) { const hit = await c.match(e.request); if (hit) return hit;
      const r = await fetch(e.request); if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }
    try { const r = await fetch(e.request, { cache: 'no-cache' }); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch (err) { const hit = await c.match(e.request); if (hit) return hit; throw err; }
  }));
});
