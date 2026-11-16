const CACHE_NAME = "prontdiu-cache-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./insercao.html",
  "./records.html",
  "./styles.css",
  "./app.js",
  "./insercao.js",
  "./records.js",
  "./db.js",
  "./ui.js",
  "./form-utils.js",
  "./form-page.js",
  "./print.js",
  "./export.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/LOGO.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS.map((asset) => new Request(asset, { cache: "reload" }))))
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

// Estratégia "stale-while-revalidate": responde na hora com o que está em cache (funciona
// sempre offline) e, havendo rede, atualiza o cache em segundo plano para a próxima abertura.
// Assim não é preciso trocar CACHE_NAME a cada publicação.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Parâmetros como "?new=true" não mudam o arquivo servido; a chave do cache os ignora.
  url.search = "";
  url.hash = "";

  event.respondWith(respond(event, url.href));
});

async function respond(event, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(cacheKey);

  const refresh = fetch(cacheKey, { cache: "no-cache" }).then(async (response) => {
    if (response.ok) await cache.put(cacheKey, response.clone());
    return response;
  });

  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }

  return refresh;
}
