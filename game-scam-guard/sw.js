const CACHE = 'gamescam-guard-site-v6';
const APP_PATH = new URL('./',self.location.href).pathname;
const asset = name => `${APP_PATH}${name}`;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([APP_PATH,asset('manifest.webmanifest'),asset('favicon.svg'),asset('icons/icon-192.png'),asset('icons/icon-512.png'),asset('icons/apple-touch-icon.png')])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('gamescam-guard-site-') && key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never control MalGuard pages, API responses, external destinations or files.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(APP_PATH)) return;
  const relative = url.pathname.slice(APP_PATH.length);
  if (event.request.mode !== 'navigate' && !/^(assets\/|fonts\/|icons\/|favicon\.svg$|manifest\.webmanifest$|learn\/language\.js$)/.test(relative)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Localized guides are independent documents, never the app-shell fallback.
    const key = event.request.mode === 'navigate' && !relative.startsWith('learn/') ? APP_PATH : event.request;
    try {
      const response = await fetch(event.request,event.request.mode==='navigate'?{cache:'no-cache'}:undefined);
      if (response.ok && !response.redirected) await cache.put(key,response.clone());
      return response;
    } catch {
      const stored = await cache.match(key);
      if (stored) return stored;
      throw new Error('Offline resource unavailable');
    }
  })());
});
