/* Minimal service worker for Project Greenfire.
   - Network-first for navigation (HTML) so updates roll out.
   - Stale-while-revalidate for same-origin static assets (css/js/images).
*/

const SW_VERSION = 'greenfire-sw-v1';
const STATIC_CACHE = `${SW_VERSION}-static`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;

// Keep this list small and stable; runtime caching covers most assets.
const PRECACHE_URLS = [
  './',
  './index.html',
  './app.webmanifest',
  './styles/base/global.css',
  './styles/base/game-area.css',
  './styles/base/compact-mode.css',
  './styles/layout/header-footer.css',
  './styles/layout/navigation-menu.css',
  './styles/layout/info-panel.css',
  './styles/components/objectives.css',
  './styles/components/ingamelog.css',
  './styles/components/story-popup.css',
  './styles/components/combat-popup.css',
  './styles/components/options-menu.css',
  './styles/components/log-options.css',
  './styles/components/changelog.css',
  './styles/sections/research.css',
  './styles/sections/colony.css',
  './styles/sections/crashSite.css',
  './styles/sections/journal.css',
  './styles/sections/character.css',
  './styles/sections/campsite.css',
  './styles/sections/encryptedDrive.css',
  './styles/sections/localMap.css',
  './core/main.js',
  './assets/images/logo.png',
  './assets/images/logo-header.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    try {
      await cache.addAll(PRECACHE_URLS);
    } catch {
      // Ignore precache failures (e.g. some assets missing on certain branches)
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k !== STATIC_CACHE && k !== RUNTIME_CACHE) return caches.delete(k);
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

function isSameOrigin(url) {
  try {
    return url.origin === self.location.origin;
  } catch {
    return false;
  }
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.destination === 'document');
}

function isCacheableAsset(request) {
  if (request.method !== 'GET') return false;
  const dest = request.destination;
  if (['style', 'script', 'image', 'font'].includes(dest)) return true;
  const u = new URL(request.url);
  return /\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(u.pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const resp = await fetch(request);
    if (resp && resp.ok) cache.put(request, resp.clone());
    return resp;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fallback to app shell
    const shell = await caches.open(STATIC_CACHE);
    return (await shell.match('./index.html')) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = (async () => {
    try {
      const resp = await fetch(request);
      if (resp && resp.ok) cache.put(request, resp.clone());
      return resp;
    } catch {
      return null;
    }
  })();

  return cached || (await fetchPromise) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isCacheableAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
