/* ============================================================
   Service Worker — Escaneador Profissional (offline-first)

   Estratégia:
   - Cache estático: HTML, CSS, JS, manifest, ícones
   - Cache dinâmico: imagens de documentos (opcional)
   - Network-first para navegação, cache-first para assets
   ============================================================ */
const CACHE_NAME = 'escaneador-v1';
const CACHE_STATIC = 'escaneador-static-v1';
const CACHE_DOCS = 'escaneador-docs-v1';

const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/util.js',
  './js/detect.js',
  './js/warp.js',
  './js/filtros.js',
  './js/pdf.js',
  './js/banco.js',
  './js/camera.js',
  './js/telas.js',
  './js/app.js',
  './app.webmanifest'
];

const ICONES = [
  './icones/icon-192.svg',
  './icones/icon-512.svg'
];

/* ------------ install ------------ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then((cache) => cache.addAll(ASSETS)),
      caches.open(CACHE_STATIC).then((cache) => cache.addAll(ICONES))
    ]).then(() => self.skipWaiting())
  );
});

/* ------------ activate ------------ */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_DOCS)
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

/* ------------ fetch ------------ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* apenas mesmo domínio */
  if (url.origin !== location.origin) return;

  /* navegação: network-first com fallback offline */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* assets estáticos: cache-first */
  if (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image' ||
      request.destination === 'manifest') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          }
          return resp;
        });
      })
    );
    return;
  }

  /* outros: network-first */
  event.respondWith(
    fetch(request)
      .then((resp) => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_DOCS).then((cache) => cache.put(request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(request))
  );
});

/* ------------ mensagem para limpar cache de docs ------------ */
self.addEventListener('message', (event) => {
  if (event.data === 'limpar-cache-docs') {
    caches.delete(CACHE_DOCS).then(() => {
      event.ports[0]?.postMessage({ ok: true });
    });
  }
});