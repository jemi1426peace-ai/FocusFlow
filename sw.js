/* FocusFlow service worker — caches the app so it works offline.
   Bump CACHE when you publish a new version.

   Safe with hosts that redirect (Cloudflare Pages, GitHub Pages, Netlify …):
   - pages are fetched network-first, so the newest version always wins when online
   - a redirected response is never stored or replayed (iPad Safari / Android Chrome refuse
     those and show "redirection error" / "page moved")
   - /index.html and / are treated as the same page */
const CACHE = 'focusflow-v5';
const SHELL = './';
const FILES = ['css/style.css', 'js/core.js', 'js/planner.js', 'js/life.js', 'js/wellness.js', 'js/spirit.js', 'js/sync.js', 'js/main.js',
  'manifest.webmanifest', 'fonts/fredoka.woff2', 'fonts/nunito.woff2', 'fonts/patrick-hand.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

/* rebuild a response so it carries no "redirected" flag */
async function clean(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
async function grab(cache, url) {
  try {
    const res = await clean(await fetch(new Request(url, { cache: 'reload' })));
    if (res && res.ok) await cache.put(url, res);
  } catch (e) { /* one missing file must not break the install */ }
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([grab(c, SHELL)].concat(FILES.map(f => grab(c, f))))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;

  /* opening the app (any page navigation): network first, fall back to the saved app shell offline */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await clean(await fetch(req));
        if (res && res.ok) { const c = await caches.open(CACHE); c.put(SHELL, res.clone()); }
        return res;
      } catch (err) {
        const hit = await caches.match(SHELL);
        return hit || new Response('<h1>FocusFlow is offline</h1><p>Connect to the internet once to finish installing.</p>', { headers: { 'Content-Type': 'text/html' } });
      }
    })());
    return;
  }

  /* files (css, js, fonts, icons): instant from cache, refreshed quietly in the background */
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    const net = fetch(req).then(clean).then(res => {
      if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
