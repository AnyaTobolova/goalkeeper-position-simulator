// При выпуске новой версии игры поднимаем номер: старый кэш удаляется на activate.
const cacheName = "goalkeeper-sim-v3";
const shellAssets = ["/", "/index.html", "/pwa-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(shellAssets);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  // Сеть в приоритете: свежая версия подтягивается всегда, кэш - запас на оффлайн.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const sameOrigin = event.request.url.startsWith(self.location.origin);

        if (response.ok && sameOrigin) {
          const copy = response.clone();
          caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        }

        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("/index.html")))
  );
});
