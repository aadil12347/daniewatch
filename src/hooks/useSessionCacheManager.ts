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
// INCREMENTED: 2026-02-04 to force fresh cache after manifest-only architecture change
const CURRENT_APP_VERSION = "1.2.0";
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
    // Update a "last active" timestamp in localStorage whenever the tab is visible.
    // This allows us to track "sessions" without relying on sessionStorage which can be cleared by OS.
    const updateSessionRef = () => {
      localStorage.setItem("dw_last_active", Date.now().toString());
    };

    updateSessionRef();
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        updateSessionRef();
      }
    });

    // 3. Background Invalidation:
    // Check if we need to trigger a background manifest refresh (older than 30 mins)
    const checkBackgroundRefresh = () => {
      const MANIFEST_CACHE_KEY = "db_manifest_cache";
      const cached = localStorage.getItem(MANIFEST_CACHE_KEY);
      if (cached) {
        try {
          const { timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          const THIRTY_MINS = 30 * 60 * 1000;

          if (age > THIRTY_MINS) {
            console.log("[CacheManager] Manifest stale in background - triggering refresh");
            window.dispatchEvent(new CustomEvent("manifest:background-refresh"));
          }
        } catch { /* ignore */ }
      }
    };

    checkBackgroundRefresh();

    // 4. Admin Bypass:
    const isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
    if (isAdmin) {
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