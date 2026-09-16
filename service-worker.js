// Ce fichier permet à ton navigateur de considérer Eluna comme une
// vraie app installable, et met en cache les fichiers de base pour
// que l'app s'ouvre instantanément. Ça ne rend PAS Eluna utilisable
// hors connexion (il faut toujours internet pour qu'elle réfléchisse),
// ça accélère juste l'ouverture de l'app elle-même.

const CACHE_NAME = 'eluna-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/firebase-config.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // On ne met jamais en cache les appels à la fonction Eluna elle-même —
  // ses réponses doivent toujours venir du réseau, jamais du cache.
  if (event.request.url.includes('/.netlify/functions/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
