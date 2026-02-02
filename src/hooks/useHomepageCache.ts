import { useCallback, useEffect, useState } from "react";
import type { Movie } from "@/lib/tmdb";

const CACHE_KEY = "dw_homepage_cache";
const SESSION_CHECK_KEY = "homepage_session_checked";
const ADMIN_SESSION_KEY = "admin_session_active";

interface HomepageCacheData {
  trending: Movie[];
  indianPopular: Movie[];
  koreanPopular: Movie[];
  animePopular: Movie[];
  topRatedMovies: Movie[];
  topRatedTV: Movie[];
  timestamp: number;
}

export const useHomepageCache = () => {
  // Check if this is a new session on mount
  useEffect(() => {
    const isAdminSession = sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
    const sessionChecked = sessionStorage.getItem(SESSION_CHECK_KEY);

    if (!sessionChecked && !isAdminSession) {
      // New user session - clear old cache so they get fresh data
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.setItem(SESSION_CHECK_KEY, "1");
      console.log("[HomepageCache] New session - cleared old cache");
    }
  }, []);

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
