import { useEffect } from "react";

const SESSION_ACTIVE_KEY = "dw_cache_session_active";
const ADMIN_SESSION_KEY = "admin_session_active";
const USER_MANIFEST_CACHE_KEY = "db_manifest_cache";
const HOMEPAGE_CACHE_KEY = "dw_homepage_cache";

/**
 * Manages session-based caching with different behavior for admin vs user:
 * - Admin: uses sessionStorage exclusively (auto-clears on browser close)
 * - User: refreshes localStorage cache on each new session
 */
export function useSessionCacheManager() {
  useEffect(() => {
    const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY);
    const isAdminSession = sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";

    if (!sessionActive) {
      // New session detected
      sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");

      // For regular users: clear old localStorage cache so they get fresh data
      if (!isAdminSession) {
        localStorage.removeItem(USER_MANIFEST_CACHE_KEY);
        console.log("[SessionCache] New user session - cleared localStorage manifest cache");
      }
      // Admin sessions use sessionStorage which auto-clears on browser close
    }

    // Visibility listener removed to prevent unwanted session resets/rehashing on tab switch.
    // The initial session check (above) is sufficient for start-up cache clearing.
  }, []);
}

/**
 * Mark the current session as an admin session.
 * Call this when admin pages are accessed.
 */
export function markAdminSession() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
}

/**
 * Clear admin session marker.
 * Call this when admin logs out.
 */
export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}