const TMDB_KEY = "fc6d85b3839330e3458701b975195487";

function postPrefetch(urls: string[]) {
  try {
    const controller = navigator.serviceWorker?.controller;
    controller?.postMessage({ type: "PREFETCH_URLS", urls });
  } catch {
    // ignore
  }
}

function tmdbDiscoverUrl(kind: "movie" | "tv", extra: Record<string, string> = {}) {
  const today = new Date().toISOString().split("T")[0];
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    include_adult: "false",
    page: "1",
    ...(kind === "movie"
      ? { sort_by: "primary_release_date.desc", "vote_count.gte": "50", "primary_release_date.lte": today }
      : { sort_by: "first_air_date.desc", "vote_count.gte": "20", "first_air_date.lte": today }),
    ...extra,
  });
  return `https://api.themoviedb.org/3/discover/${kind}?${params.toString()}`;
}

/**
 * Intent-based prefetching:
 * - primes the SPA navigation route
 * - primes the likely TMDB API request for that destination
 */
export function intentPrefetch(to: string) {
  if (typeof window === "undefined") return;
  if (!to) return;

  const urls: string[] = [];

  try {
    const u = new URL(to, window.location.origin);
    urls.push(u.toString());
  } catch {
    // ignore
  }

  if (to === "/movies") {
    urls.push(tmdbDiscoverUrl("movie"));
  } else if (to === "/tv") {
    urls.push(tmdbDiscoverUrl("tv"));
  } else if (to === "/anime") {
    urls.push(tmdbDiscoverUrl("tv", { with_genres: "16", with_original_language: "ja" }));
  } else if (to === "/korean") {
    urls.push(tmdbDiscoverUrl("movie", { with_original_language: "ko" }));
    urls.push(tmdbDiscoverUrl("tv", { with_original_language: "ko" }));
  }

  if (urls.length) postPrefetch(urls);
}
