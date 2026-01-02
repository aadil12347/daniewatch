import { useCallback } from "react";
import { useLocation } from "react-router-dom";

const CACHE_KEY_PREFIX = "listCache_";
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

interface CacheData<T> {
  items: T[];
  page: number;
  hasMore: boolean;
  activeTab: string;
  selectedFilters: number[];
  timestamp: number;
}

export const useListStateCache = <T>() => {
  const location = useLocation();
  const storageKey = `${CACHE_KEY_PREFIX}${location.pathname}`;

  const saveCache = useCallback(
    (data: Omit<CacheData<T>, "timestamp">) => {
      const cacheData: CacheData<T> = {
        ...data,
        timestamp: Date.now(),
      };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(cacheData));
      } catch (error) {
        console.warn("Failed to save list cache:", error);
      }
    },
    [storageKey]
  );

  const getCache = useCallback(
    (currentTab: string, currentFilters: number[]): CacheData<T> | null => {
      try {
        const cached = sessionStorage.getItem(storageKey);
        if (!cached) return null;

        const data: CacheData<T> = JSON.parse(cached);
        
        // Check if cache is expired
        if (Date.now() - data.timestamp > CACHE_EXPIRATION_MS) {
          sessionStorage.removeItem(storageKey);
          return null;
        }

        // Check if filters/tab match
        const filtersMatch = 
          data.activeTab === currentTab &&
          JSON.stringify(data.selectedFilters.sort()) === JSON.stringify(currentFilters.sort());

        if (!filtersMatch) {
          sessionStorage.removeItem(storageKey);
          return null;
        }

        return data;
      } catch (error) {
        console.warn("Failed to read list cache:", error);
        return null;
      }
    },
    [storageKey]
  );

  const clearCache = useCallback(() => {
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  return { saveCache, getCache, clearCache };
};
