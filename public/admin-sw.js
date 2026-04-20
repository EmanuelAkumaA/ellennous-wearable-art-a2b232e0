// Ellennous Admin — minimal service worker scoped to /admin
const CACHE = "ellennous-admin-v2";
const APP_SHELL = [
  "/admin",
  "/admin/",
  "/brand-icon.png",
  "/admin-icon-192.png",
  "/admin-icon-512.png",
  "/admin-splash.png",
  "/admin-manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin requests within /admin scope
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/admin") && !url.pathname.startsWith("/brand-icon")) return;

  // Network-first with cache fallback (good for SPA navigations)
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("/admin"))
      )
  );
});
