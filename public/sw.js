/* COZMC service worker: the arcade works offline; chain data always comes live.
   - the built app (listed in sw-manifest.js at build time): precached on install
   - other built files and images: cache-first
   - pages: network-first, falling back to the cached shell
   - Google Fonts: stale-while-revalidate
   - algod / indexer / NFD / YouTube: straight to the network, never cached */
try { importScripts('/sw-manifest.js') } catch { self.__BUILD = { version: 'dev', files: [] } }
const SHELL = `cozmc-shell-${self.__BUILD.version}`
const FONTS = 'cozmc-fonts-v1'
const PRECACHE = ['/', '/manifest.webmanifest', '/assets/card-face.webp', '/assets/cozmc-wordmark.png', '/assets/cozmc-logo-272.png', '/icons/icon-192.png', ...self.__BUILD.files]

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const cacheable = (req, res) => res && res.status === 200 && res.type !== 'opaqueredirect' && !req.headers.has('range')

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreVary: true })   // hashed files never change; don't let Vary: Origin split them
  if (hit) return hit
  const res = await fetch(req)
  if (cacheable(req, res)) caches.open(SHELL).then(c => c.put(req, res.clone()))
  return res
}

async function networkFirst(req) {
  try {
    const res = await fetch(req)
    if (cacheable(req, res)) caches.open(SHELL).then(c => c.put('/', res.clone()))
    return res
  } catch {
    return (await caches.match('/')) || Response.error()
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(FONTS)
  const hit = await cache.match(req, { ignoreVary: true })
  const fresh = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res }).catch(() => hit)
  return hit || fresh
}

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req))
    if (/^\/(static|assets|icons)\//.test(url.pathname) && !url.pathname.endsWith('.mp4')) return e.respondWith(cacheFirst(req))
    return
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return e.respondWith(staleWhileRevalidate(req))
})
