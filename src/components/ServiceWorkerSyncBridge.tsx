import React from "react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type SwMessage =
  | { type: "CACHE_UPDATED"; cacheName?: string; url?: string; ts?: number }
  | { type: "SW_ACTIVATED"; ts?: number }
  | { type: string; [key: string]: unknown };

function shouldInvalidateForUrl(url?: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname === "api.themoviedb.org") return true;
    if (u.hostname === "image.tmdb.org") return true;
    return false;
  } catch {
    return false;
  }
}

export function ServiceWorkerSyncBridge({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const onMessage = (e: Event) => {
      const detail = (e as CustomEvent).detail as SwMessage | undefined;
      if (!detail || typeof detail !== "object") return;

      if (detail.type === "CACHE_UPDATED") {
        // Invalidate only when SW updated TMDB-related caches.
        const url = typeof (detail as any).url === "string" ? ((detail as any).url as string) : undefined;
        if (!shouldInvalidateForUrl(url)) return;

        // Target common prefixes used in this app (preloader + any future queries).
        queryClient.invalidateQueries({
          predicate: (q) => {
            const k = q.queryKey;
            const root = Array.isArray(k) ? String(k[0] ?? "") : "";
            return ["movies", "tv", "anime", "korean", "search", "tmdb"].includes(root);
          },
        });

        // Also emit a generic event so non-React-Query pages can opt-in to refresh fragments.
        window.dispatchEvent(new CustomEvent("tmdb:cache-updated", { detail }));
      }

      if (detail.type === "SW_ACTIVATED") {
        // Silent update: keep UI running; only refresh data in the background.
        queryClient.invalidateQueries();
        window.dispatchEvent(new CustomEvent("sw:activated", { detail }));
      }
    };

    window.addEventListener("sw:message", onMessage as EventListener);
    return () => window.removeEventListener("sw:message", onMessage as EventListener);
  }, [enabled, queryClient]);

  return null;
}
