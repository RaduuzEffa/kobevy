const CACHE_NAME = 'crva-pcr-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap'
];

// Instalace SW a vytvoření lokální cache pro offline provoz
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Soubory byly nacachovány pro offline přístup.');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Aktivace a pročištění starých cache (pro případ updatu)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      );
    })
  );
});

// Interceptování požadavků: NETWORK FIRST (zajistí okamžité aktualizace, pokud jsme online)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Uložíme si novou verzi do cache pro budoucí offline použití
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Pokud jsme offline (fetch selže), sáhneme do lokální cache
        return caches.match(event.request);
      })
  );
});
