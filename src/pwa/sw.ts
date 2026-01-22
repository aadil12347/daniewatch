/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
cleanupOutdatedCaches();

// Precache all core hashed assets (JS/CSS) and the app shell.
precacheAndRoute(self.__WB_MANIFEST);

// Offline-first SPA navigation: serve the cached shell for all navigation requests.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// === Runtime caching ===

// TMDB API (SWR)
registerRoute(
  ({ url }) => url.origin === "https://api.themoviedb.org" && url.pathname.startsWith("/3/"),
  new StaleWhileRevalidate({
    cacheName: "tmdb-api-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
);

// Supabase storage (manifest + any internal JSON assets) (SWR)
registerRoute(
  ({ url, request }) =>
    request.destination === "" &&
    (url.pathname.includes("/storage/v1/") || url.pathname.endsWith(".json")) &&
    url.origin.includes("supabase"),
  new StaleWhileRevalidate({
    cacheName: "app-data-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 14 * 24 * 60 * 60,
      }),
    ],
  })
);

// Images (Cache-First)
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 1500,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

// === Priority caching ===

type CachePriorityItemsMessage = {
  type: "CACHE_PRIORITY_ITEMS";
  payload: {
    routeKey: string;
    urls: string[];
  };
};

const PERMANENT_CACHE = "dw-permanent-v1";

async function cachePermanent(urls: string[]) {
  const cache = await caches.open(PERMANENT_CACHE);

  await Promise.all(
    urls
      .filter(Boolean)
      .slice(0, 50)
      .map(async (url) => {
        try {
          const req = new Request(url, { mode: "cors", credentials: "omit" });
          const existing = await cache.match(req);
          if (existing) return;
          const res = await fetch(req);
          if (!res.ok) return;
          await cache.put(req, res);
        } catch {
          // swallow
        }
      })
  );
}

self.addEventListener("message", (event) => {
  const data = event.data as CachePriorityItemsMessage | undefined;
  if (!data || data.type !== "CACHE_PRIORITY_ITEMS") return;
  void cachePermanent(data.payload.urls);
});
