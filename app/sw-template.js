/* Cache offline somente dos arquivos do programa. NUNCA guarda o histórico pessoal. */
const CACHE = '__CACHE__';
const ASSETS = __ASSETS__;
const scope = self.registration.scope;
const appIndex = new URL('./index.html', scope).href;
const appRoot = new URL('./', scope).href;
const shellPaths = new Set(ASSETS.map(a => new URL(a, scope).pathname).concat([new URL('./', scope).pathname]));

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS.map(a => new Request(new URL(a, scope), { cache: 'reload' })));
  const index = await cache.match(appIndex);
  if (index) await cache.put(appRoot, index.clone());
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  // Remove os caches das versões anteriores (inclusive do app antigo), nunca dados pessoais.
  const names = await caches.keys();
  await Promise.all(names.filter(n => n.startsWith('treino-evolucao-android-shell-') && n !== CACHE).map(n => caches.delete(n)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const isNav = req.mode === 'navigate' && (url.pathname === new URL(appRoot).pathname || url.pathname === new URL(appIndex).pathname);
  if (!isNav && !shellPaths.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(isNav ? appIndex : req, { ignoreSearch: isNav });
    return hit || fetch(req);
  })());
});
