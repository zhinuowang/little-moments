// Little Moments service worker — offline app shell. No data ever leaves the device.
const CACHE = 'little-moments-v2'
// paths are relative to this script, so the app also works under a sub-path (GitHub Pages)
const SCOPE = new URL('./', self.location).pathname
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './privacy.html']

/** Same-origin files the app needs offline: built assets and the files beside index.html. */
function cacheable(url) {
  const u = new URL(url, self.location)
  return u.origin === self.location.origin && u.pathname.startsWith(SCOPE) && !u.pathname.endsWith('/sw.js')
}

async function cacheAll(urls) {
  const c = await caches.open(CACHE)
  await Promise.all(urls.filter(cacheable).map(async (url) => {
    if (await c.match(url, { ignoreVary: true })) return
    try { const res = await fetch(url); if (res.ok) await c.put(url, res) } catch { /* offline: try again next visit */ }
  }))
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE)
    await c.addAll(SHELL)
    // the entry script and stylesheet named in index.html, so the very first visit works offline
    const html = await (await c.match('./index.html')).text()
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], self.location).href)
    await cacheAll(assets)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

// the page lists what it loaded before this worker took over (lazy chunks, fonts); keep copies
self.addEventListener('message', (e) => {
  if (e.data?.type === 'cache-urls' && Array.isArray(e.data.urls)) e.waitUntil(cacheAll(e.data.urls.slice(0, 500)))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    // network first so updates arrive; offline, the page itself or else the app shell
    const path = new URL(req.url).pathname
    const shell = path === SCOPE || path === `${SCOPE}index.html`
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(shell ? './index.html' : req, copy)) }
        return res
      }).catch(async () => (shell ? undefined : await caches.match(req, { ignoreSearch: true, ignoreVary: true })) ?? caches.match('./index.html')),
    )
    return
  }
  // hashed assets: cache first (ignoreVary: copies cached by the worker were fetched without the
  // page's Origin header, and some servers answer with `Vary: Origin`)
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
      return res
    })),
  )
})
