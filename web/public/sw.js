// Service worker: guarda o "casco" do app para abrir sem internet.
// As chamadas à API (script.google.com) nunca passam por cache.
const CACHE = 'avaliacao-ps-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './config.js', './manifest.webmanifest', './marca/simbolo-192.png', './marca/simbolo-96.png', './marca/assinatura-horizontal-positiva.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const ehPagina = e.request.mode === 'navigate' || url.pathname.endsWith('/config.js') || url.pathname.endsWith('.html');
  if (ehPagina) {
    // Rede primeiro (pega versão nova), cache se estiver sem internet.
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
  } else {
    // Arquivos com hash no nome: cache primeiro.
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      if (resp.ok) { const c = resp.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
      return resp;
    })));
  }
});
