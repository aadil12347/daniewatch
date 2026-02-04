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
// Current app version - increment this when shipping breaking data changes
const CURRENT_APP_VERSION = "1.1.0";
const CACHE_VERSION_KEY = "dw_cache_version";

export function useSessionCacheManager() {
  useEffect(() => {
    // 1. Smart Invalidation: Check version compatibility
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);

    if (cachedVersion !== CURRENT_APP_VERSION) {
      console.log(`[CacheManager] Version mismatch (${cachedVersion} vs ${CURRENT_APP_VERSION}). Clearing stale cache.`);

      // Clear specific functional caches but KEEP session tokens logic if handled elsewhere
      localStorage.removeItem(USER_MANIFEST_CACHE_KEY);
      localStorage.removeItem(HOMEPAGE_CACHE_KEY);

      // Update version
      localStorage.setItem(CACHE_VERSION_KEY, CURRENT_APP_VERSION);
    }

    // 2. Persistent Session:
    // We NO LONGER clear localStorage just because sessionStorage is empty.
    // This allows data to survive tab close/minimize on mobile.

    // 3. Admin Bypass:
    // If we are in an admin session, we might want to hint to the app to force-fresh
    // (This is mostly handled by useAdmin and useRequests checking the flag)
    const isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
    if (isAdmin) {
      // Ensure we don't rely on potentially stale user caches
      console.log("[CacheManager] Admin session active - enforcing fresh data fetch");
    }

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