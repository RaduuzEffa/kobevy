const CACHE_NAME = 'crva-pcr-cache-v1';
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

// Interceptování požadavků a jejich servírování z Cache, pokud jsme offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Pokud najdeme soubor v cache, vrátíme jej, jinak zkusíme stáhnout z netu
        return response || fetch(event.request);
      })
  );
});
