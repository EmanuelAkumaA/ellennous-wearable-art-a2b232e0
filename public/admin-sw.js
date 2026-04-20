// Ellennous Admin — minimal service worker scoped to /admin
const CACHE = "ellennous-admin-v4";
const APP_SHELL = [
  "/admin",
  "/brand-icon.png",
  "/admin-icon-192.png",
  "/admin-icon-512.png",
  "/admin-splash.png",
  "/admin-manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Use Promise.allSettled so one missing asset doesn't abort install
      await Promise.allSettled(
        APP_SHELL.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => (res && res.ok ? cache.put(url, res.clone()) : undefined))
            .catch(() => undefined)
        )
      );
    })
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
  if (url.origin !== self.location.origin) return;

  const isAdminScope =
    url.pathname.startsWith("/admin") || url.pathname.startsWith("/brand-icon");
  if (!isAdminScope) return;

  // Navigation requests (SPA deep links): network first, fallback to cached /admin
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/admin", copy)).catch(() => undefined);
          return res;
        })
        .catch(async () => {
          const cached = await caches.match("/admin");
          return cached || Response.error();
        })
    );
    return;
  }

  // Other GETs: network-first with cache fallback
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error()))
  );
});
