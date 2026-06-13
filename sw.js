/* ChessMate service worker — offline app shell.
   Network calls to lichess/chess.com are never cached (user-triggered only). */
const CACHE = 'chessmate-v1';
const ASSETS = [
  './app.html',
  './index.html',
  './styles.css',
  './app.css',
  './app-main.js',
  './engine.js',
  './board.js',
  './classify.js',
  './vendor/chess.js',
  './vendor/stockfish.js',
  './manifest.json'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  // never touch external APIs — let them hit the network directly
  if(url.origin !== self.location.origin){ return; }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res=>{
      // runtime-cache same-origin GETs
      if(e.request.method==='GET' && res.ok){
        const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy));
      }
      return res;
    }).catch(()=>hit))
  );
});
