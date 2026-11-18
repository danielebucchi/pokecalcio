// Service worker di PokéCalcio: il gioco funziona anche offline.
// - pagina (index.html): prima la rete, così un nuovo deploy arriva subito; offline la copia salvata
// - asset con hash (/assets/), icone, sprite dei Pokémon e font: dalla cache, scaricati una volta sola
const VERSION = 'pokecalcio-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/favicon-64.png'];
const LONG_LIVED = [/^\/assets\//, /^\/icons\//, /raw\.githubusercontent\.com\/PokeAPI\/sprites\//, /fonts\.(googleapis|gstatic)\.com/];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// la pagina, appena il service worker è attivo, manda l'elenco di quello che ha già scaricato
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache' || !Array.isArray(e.data.urls)) return;
  e.waitUntil(caches.open(VERSION).then((c) =>
    Promise.all(e.data.urls.filter(wanted).map((u) => c.match(u).then((hit) => hit || fetch(u, { mode: modeFor(u) }).then((r) => c.put(u, r)).catch(() => {})))),
  ));
});

const wanted = (u) => {
  const url = new URL(u, self.location.href);
  return url.origin === self.location.origin
    ? url.pathname === '/' || LONG_LIVED.some((re) => re.test(url.pathname)) || url.pathname === '/manifest.webmanifest'
    : LONG_LIVED.some((re) => re.test(url.href));
};
// i font vanno chiesti con CORS (altrimenti il browser non li usa); sprite e CSS dei font come le <img>
const modeFor = (u) => {
  const url = new URL(u, self.location.href);
  if (url.origin === self.location.origin) return 'same-origin';
  return url.hostname === 'fonts.gstatic.com' ? 'cors' : 'no-cors';
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(VERSION).then((c) => c.put('/', copy));
          return r;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  if (!LONG_LIVED.some((re) => re.test(url.origin === self.location.origin ? url.pathname : url.href))) return;
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((r) => {
        // anche le risposte "opache" degli sprite (altro dominio) vanno bene per le <img> e il canvas
        if (r.ok || r.type === 'opaque') {
          const copy = r.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return r;
      }),
    ),
  );
});
