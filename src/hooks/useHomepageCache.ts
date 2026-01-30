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
    } catch (error) {
      console.warn("Failed to save homepage cache:", error);
    }
  }, []);

  const getCache = useCallback((): HomepageCacheData | null => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: HomepageCacheData = JSON.parse(cached);
      return data;
    } catch (error) {
      console.warn("Failed to read homepage cache:", error);
      return null;
    }
  }, []);

  const clearCache = useCallback(() => {
    sessionStorage.removeItem(CACHE_KEY);
  }, []);

  return { saveCache, getCache, clearCache };
};
