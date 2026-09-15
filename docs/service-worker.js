const CACHE_NAME = 'todo-rosamango-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((chave) => chave !== CACHE_NAME).map((chave) => caches.delete(chave)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  // Chamadas ao backend (Apps Script, outra origem) nunca passam pelo cache: sempre rede.
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      if (respostaCache) return respostaCache;
      return fetch(evento.request).then((respostaRede) => {
        const clone = respostaRede.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, clone));
        return respostaRede;
      });
    })
  );
});
