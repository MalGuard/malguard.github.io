const CACHE = 'gamescam-guard-site-v2';
const APP_PATH = new URL('./',self.location.href).pathname;
const asset = name => `${APP_PATH}${name}`;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([APP_PATH,asset('manifest.webmanifest'),asset('favicon.svg')])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('gamescam-guard-site-') && key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never control MalGuard pages, API responses, external destinations or files.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(APP_PATH)) return;
  const relative = url.pathname.slice(APP_PATH.length);
  if (event.request.mode !== 'navigate' && !/^(assets\/|fonts\/|icons\/|favicon\.svg$|manifest\.webmanifest$)/.test(relative)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = event.request.mode === 'navigate' ? APP_PATH : event.request;
    try {
      const response = await fetch(event.request);
      if (response.ok && !response.redirected) await cache.put(key,response.clone());
      return response;
    } catch {
      const stored = await cache.match(key);
      if (stored) return stored;
      throw new Error('Offline resource unavailable');
    }
  })());
});
