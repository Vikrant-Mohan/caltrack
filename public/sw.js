/* CalTrack service worker — app-shell + static asset caching.
 * Registered only in production builds (see ServiceWorkerRegister). */

const VERSION = "v1";
const CORE_CACHE = `caltrack-core-${VERSION}`;
const STATIC_CACHE = `caltrack-static-${VERSION}`;

self.addEventListener("install", () => {
  // Activate immediately so the new SW takes over without waiting for
  // the next page load.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("caltrack-") && !k.endsWith(`-${VERSION}`))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only same-origin traffic is cached; API proxies and external food images
  // always hit the network.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network-first with an offline fallback to the cached
  // app shell (the shell stores hashed chunks as they're fetched, so repeat
  // visits and offline launches work once it has been loaded once).
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CORE_CACHE);
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const shell =
            (await cache.match(request)) || (await cache.match("/"));
          if (shell) return shell;
          return Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets (/_next/static, /icons, ...): stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      })(),
    );
    return;
  }
});
