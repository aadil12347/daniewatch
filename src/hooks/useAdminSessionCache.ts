import { useEffect } from "react";
import { useAdminStatus } from "@/contexts/AdminStatusContext";

const SESSION_KEY = "dw_cache_session_id";
const ADMIN_MANIFEST_CACHE_KEY = "admin_db_manifest_cache";
const USER_MANIFEST_CACHE_KEY = "db_manifest_cache";
const USER_HOMEPAGE_CACHE_KEY = "dw_homepage_cache";

/**
 * Session-aware cache management for admin vs user.
 * 
 * Admin behavior:
 * - Uses sessionStorage for all caches (auto-clears on browser close)
 * - Fresh data every new browser session
 * 
 * User behavior:
 * - Uses localStorage with session check
 * - Refreshes localStorage cache on new session
 */
export function useAdminSessionCache() {
  const { isAdmin, isLoading } = useAdminStatus();

  useEffect(() => {
    if (isLoading) return;

    const currentSession = sessionStorage.getItem(SESSION_KEY);

    if (!currentSession) {
      // New session - generate session ID
      const newSessionId = Date.now().toString();
      sessionStorage.setItem(SESSION_KEY, newSessionId);

      if (!isAdmin) {
        // User: clear old localStorage cache so they get fresh data
        clearUserCache();
      }
      // Admin: sessionStorage auto-clears when browser closes, nothing to do
    }
  }, [isAdmin, isLoading]);
}

/**
 * Clear user-specific caches from localStorage
 */
export function clearUserCache() {
  localStorage.removeItem(USER_MANIFEST_CACHE_KEY);
  localStorage.removeItem(USER_HOMEPAGE_CACHE_KEY);
  console.log("[SessionCache] Cleared user localStorage cache for new session");
}

/**
 * Get the appropriate cache storage based on admin status
 */
export function getCacheStorage(isAdmin: boolean): Storage {
  return isAdmin ? sessionStorage : localStorage;
}

/**
 * Get the manifest cache key based on admin status
 */
export function getManifestCacheKey(isAdmin: boolean): string {
  return isAdmin ? ADMIN_MANIFEST_CACHE_KEY : USER_MANIFEST_CACHE_KEY;
}

/**
 * Check if this is a new session (for cache invalidation)
 */
export function isNewSession(): boolean {
  return !sessionStorage.getItem(SESSION_KEY);
}

/**
 * Force a cache refresh by clearing the session marker
 */
export function forceCacheRefresh() {
  sessionStorage.removeItem(SESSION_KEY);
  clearUserCache();
}
