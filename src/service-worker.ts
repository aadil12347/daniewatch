/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

const BC_NAME = "dw-sw";

cleanupOutdatedCaches();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// --- Helpers -----------------------------------------------------------------

const broadcast = (msg: any) => {
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage(msg);
    bc.close();
  } catch {
    // ignore
  }
};

// Workbox plugin to notify UI whenever a cached response is updated.
const broadcastOnUpdate = (cacheName: string) => ({
  cacheDidUpdate: async ({ request }: { request: Request }) => {
    broadcast({ type: "CACHE_UPDATED", cacheName, url: request.url, ts: Date.now() });
  },
});

// --- App shell / navigations (SPA) -------------------------------------------

// Cache navigations with SWR so repeat opens are instant (even offline).
registerRoute(
  ({ request }) => request.mode === "navigate",
  new StaleWhileRevalidate({
    cacheName: "dw-pages",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      broadcastOnUpdate("dw-pages"),
    ],
  })
);

// --- TMDB API (JSON) ----------------------------------------------------------

registerRoute(
  ({ url, request }) =>
    request.method === "GET" &&
    url.hostname === "api.themoviedb.org" &&
    url.pathname.startsWith("/3/"),
  new StaleWhileRevalidate({
    cacheName: "dw-tmdb-api",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 24 * 60 * 60 }),
      broadcastOnUpdate("dw-tmdb-api"),
    ],
  })
);

// --- Images (TMDB + any other) ------------------------------------------------

registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "dw-images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 1500, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      broadcastOnUpdate("dw-images"),
    ],
  })
);

// --- JS/CSS (runtime) ---------------------------------------------------------

registerRoute(
  ({ request }) => request.destination === "script" || request.destination === "style" || request.destination === "font",
  new StaleWhileRevalidate({
    cacheName: "dw-assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// --- Prefetch priming ---------------------------------------------------------

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }

  if (data.type === "PREFETCH_URLS") {
    const urls = Array.isArray(data.urls) ? (data.urls as string[]) : [];
    void (async () => {
      for (const u of urls) {
        try {
          await fetch(u, { credentials: "same-origin" });
        } catch {
          // ignore
        }
      }
      broadcast({ type: "PREFETCH_DONE", count: urls.length, ts: Date.now() });
    })();
  }
});

self.addEventListener("activate", () => {
  broadcast({ type: "SW_ACTIVATED", ts: Date.now() });
});
