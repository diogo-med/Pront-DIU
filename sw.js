const CACHE_NAME = "prontdiu-cache-v2.1";
const ASSETS = [
  "./",
  "./index.html",
  "./insercao.html",
  "./styles.css",
  "./app.js",
  "./insercao.js",
  "./db.js",
  "./ui.js",
  "./form-utils.js",
  "./print.js",
  "./manifest.webmanifest",
  "./icons/icon.png",
  "./icons/LOGO.png",
  "./records.html",
  "./records.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});

