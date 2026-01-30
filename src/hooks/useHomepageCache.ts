import { useCallback } from "react";
import type { Movie } from "@/lib/tmdb";

const CACHE_KEY = "dw_homepage_cache";

interface HomepageCacheData {
  trending: Movie[];
  popularMovies: Movie[];
  topRatedMovies: Movie[];
  popularTV: Movie[];
  topRatedTV: Movie[];
  animePopular: Movie[];
  koreanPopular: Movie[];
  timestamp: number;
}

export const useHomepageCache = () => {
  const saveCache = useCallback((data: Omit<HomepageCacheData, "timestamp">) => {
    try {
      const cacheData: HomepageCacheData = {
        ...data,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log("[HomepageCache] Saved to cache, items:", data.trending?.length);
    } catch (error) {
      console.warn("[HomepageCache] Failed to save:", error);
    }
  }, []);

  const getCache = useCallback((): HomepageCacheData | null => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      console.log("[HomepageCache] Checking cache, found:", !!cached);
      if (!cached) return null;

      const data: HomepageCacheData = JSON.parse(cached);
      console.log("[HomepageCache] Cache hit! Items:", data.trending?.length);
      return data;
    } catch (error) {
      console.warn("[HomepageCache] Failed to read:", error);
      return null;
    }
  }, []);

  const clearCache = useCallback(() => {
    sessionStorage.removeItem(CACHE_KEY);
  }, []);

  return { saveCache, getCache, clearCache };
};
