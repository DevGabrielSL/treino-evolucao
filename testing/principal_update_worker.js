// The build inserts CACHE and ASSETS above this point.
const scope = self.registration.scope;
const appRoot = new URL('./', scope).href;
const appIndex = new URL('./index.html', scope).href;
const versionedIndex = new URL('./index.html?release=203', scope).href;
const shellPaths = new Set(ASSETS.map(asset => new URL(asset, scope).pathname));

self.addEventListener('install', event => {
  event.waitUntil(installShell());
});

async function installShell() {
  const index = await fetch(versionedIndex, {cache: 'reload'});
  if (!index.ok || !(await index.clone().text()).includes('src="./app.js?v=203"')) {
    throw new Error('HTML da nova versão ainda indisponível');
  }

  const cache = await caches.open(CACHE);
  const files = ASSETS.filter(asset => asset !== './' && asset !== './index.html');
  await cache.addAll(files.map(asset => new Request(new URL(asset, scope), {cache: 'reload'})));
  await Promise.all([cache.put(appRoot, index.clone()), cache.put(appIndex, index)]);

  // The complete shell is ready. Let an installed app adopt it even with
  // another tab open. No page is reloaded while a workout is in progress.
  await self.skipWaiting();
}

self.addEventListener('activate', event => {
  event.waitUntil(activateShell());
});

async function activateShell() {
  const names = await caches.keys();
  const oldShells = names.filter(name => name.startsWith('treino-evolucao-android-shell-') && name !== CACHE);
  await Promise.all(oldShells.map(name => caches.delete(name)));
  await self.clients.claim();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !shellPaths.has(url.pathname)) {
    return;
  }
  event.respondWith(readShell(request, url));
});

async function readShell(request, url) {
  const cache = await caches.open(CACHE);
  const canonical = url.origin + url.pathname;
  const isAppEntry = request.mode === 'navigate' && (canonical === appRoot || canonical === appIndex);
  // Serve the same verified HTML and assets online and offline. Query strings
  // on a navigation never select a previously cached app version.
  const cached = await cache.match(isAppEntry ? appIndex : request);
  return cached || fetch(request);
}
