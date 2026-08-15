/* 酒局管家 Service Worker
 * 简单离线缓存：先网络后缓存（network-first），保证资源新鲜且支持基本离线。
 */
const CACHE_NAME = "jiuju-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  // API 请求不缓存，始终走网络
  if (request.url.includes("/api/")) {
    return;
  }

  // 非 GET 导航或资源：先网络，失败再回退缓存
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) {
            return cached;
          }
          // 导航请求回退到首页（SPA）
          if (request.mode === "navigate") {
            return caches.match("/");
          }
          return Response.error();
        }),
      ),
  );
});
