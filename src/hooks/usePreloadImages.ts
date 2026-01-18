import { useEffect, useMemo, useRef, useState } from "react";

type PreloadState = {
  loaded: number;
  total: number;
  done: boolean;
};

const preloadOne = (url: string, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (!url) return resolve();
    if (signal?.aborted) return resolve();

    const img = new Image();
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanup();
      resolve();
    };
    img.onerror = () => {
      cleanup();
      resolve();
    };

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          cleanup();
          resolve();
        },
        { once: true }
      );
    }

    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
  });

/**
 * Preload a list of image URLs with limited concurrency.
 * Returns progress counters so callers can gate UI until a threshold is hit.
 */
export const usePreloadImages = (
  urls: Array<string | null | undefined>,
  {
    enabled = true,
    concurrency = 6,
  }: {
    enabled?: boolean;
    concurrency?: number;
  } = {}
): PreloadState => {
  const deduped = useMemo(() => {
    const set = new Set<string>();
    urls
      .filter((u): u is string => Boolean(u && u.trim()))
      .forEach((u) => set.add(u.trim()));
    return Array.from(set);
  }, [urls]);

  const total = deduped.length;
  const [loaded, setLoaded] = useState(0);

  // Prevent stale updates across reruns
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (total === 0) {
      setLoaded(0);
      return;
    }

    const runId = ++runIdRef.current;
    const controller = new AbortController();

    setLoaded(0);

    let idx = 0;
    let inFlight = 0;

    const pump = () => {
      if (controller.signal.aborted) return;
      if (runIdRef.current !== runId) return;

      while (inFlight < concurrency && idx < deduped.length) {
        const url = deduped[idx++];
        inFlight++;
        preloadOne(url, controller.signal).then(() => {
          inFlight--;
          if (runIdRef.current === runId) {
            setLoaded((v) => v + 1);
          }
          pump();
        });
      }
    };

    pump();
    return () => controller.abort();
  }, [concurrency, deduped, enabled, total]);

  return { loaded, total, done: total > 0 ? loaded >= total : true };
};
