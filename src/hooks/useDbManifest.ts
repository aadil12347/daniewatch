import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ManifestItem {
  id: number;
  media_type: "movie" | "tv";
  title: string | null;
  hover_image_url: string | null;
  genre_ids: number[];
  release_year: number | null;
  original_language: string | null;
  origin_country: string[] | null;
  poster_url: string | null;
  backdrop_url: string | null;
  logo_url: string | null;
  vote_average: number | null;
  vote_count: number | null;
  hasWatch: boolean;
  hasDownload: boolean;
}

interface Manifest {
  version: number;
  app_version: string;
  generated_at: string;
  items: ManifestItem[];
}

export interface ManifestMetadata {
  genreIds: number[];
  releaseYear: number | null;
  title: string | null;
  originalLanguage: string | null;
  originCountry: string[] | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  logoUrl: string | null;
  voteAverage: number | null;
  voteCount: number | null;
}

export interface ManifestAvailability {
  hasWatch: boolean;
  hasDownload: boolean;
  hoverImageUrl: string | null;
  logoUrl: string | null;
  voteAverage: number | null;
}

// Cache keys
const USER_CACHE_KEY = "db_manifest_cache";
const ADMIN_CACHE_KEY = "admin_db_manifest_cache";
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const SESSION_CHECK_KEY = "manifest_session_checked";
const ADMIN_SESSION_KEY = "admin_session_active";
const APP_VERSION_KEY = "dw_app_version";

export const useDbManifest = () => {
  const [manifestData, setManifestData] = useState<Manifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Detect if user is admin (check sessionStorage flag set by admin pages)
  const isAdminSession = typeof window !== "undefined" && sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";

  // Get appropriate cache key and storage
  const getCacheKey = () => (isAdminSession ? ADMIN_CACHE_KEY : USER_CACHE_KEY);
  const getCacheStorage = () => (isAdminSession ? sessionStorage : localStorage);

  // Fetch manifest from Supabase Storage
  const fetchManifest = async () => {
    try {
      // Use cache: 'no-cache' and a timestamp to bypass browser and Service Worker caches
      const { data, error } = await supabase.storage
        .from("manifests")
        .download(`db_manifest_v1.json?t=${Date.now()}`);

      if (error) {
        console.warn("[useDbManifest] Error fetching manifest:", error);
        return null;
      }

      const text = await data.text();
      const parsed: Manifest = JSON.parse(text);

      // Sort items: newest first (by release_year desc), then by rating
      parsed.items.sort((a, b) => {
        const yearA = a.release_year ?? new Date().getFullYear();
        const yearB = b.release_year ?? new Date().getFullYear();
        if (yearB !== yearA) return yearB - yearA;
        return (b.vote_average ?? 0) - (a.vote_average ?? 0);
      });

      // Cache it in appropriate storage
      const storage = getCacheStorage();
      storage.setItem(
        getCacheKey(),
        JSON.stringify({
          timestamp: Date.now(),
          data: parsed,
        })
      );

      return parsed;
    } catch (error) {
      console.error("[useDbManifest] Error parsing manifest:", error);
      return null;
    }
  };

  /**
   * Forces a total cache wipe and hard reload of the application.
   * This is triggered when the admin updates site data (manifest version changes).
   */
  const selfDestructAndReload = (newVersion: string) => {
    console.warn(`[useDbManifest] Version mismatch detected. Triggering global cache clear and hard reload...`);

    // 1. Wipe everything
    localStorage.clear();
    sessionStorage.clear();

    // 2. Set the NEW version so we don't reload again immediately
    localStorage.setItem(APP_VERSION_KEY, newVersion);

    // 3. Force hard reload from server (bypass disk cache)
    window.location.reload();
  };

  // Load manifest on mount
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const storage = getCacheStorage();
      const cacheKey = getCacheKey();

      let forceFreshLoad = false;
      // Persistent session management: 
      // Treat session as "new" only if inactive for > 4 hours OR if it's the very first visit.
      if (!isAdminSession) {
        const lastActive = parseInt(localStorage.getItem("dw_last_active") || "0", 10);
        const now = Date.now();
        const FOUR_HOURS = 4 * 60 * 60 * 1000;

        const sessionChecked = sessionStorage.getItem(SESSION_CHECK_KEY);

        // If it's a new browser session AND we've been inactive for a long time, force fresh fetch.
        // If it's just a focus regain or a short sleep, keep the cache.
        if (!sessionChecked && (now - lastActive > FOUR_HOURS)) {
          console.log("[useDbManifest] Long inactivity detected - clearing cache for fresh session");
          localStorage.removeItem(USER_CACHE_KEY);
          sessionStorage.setItem(SESSION_CHECK_KEY, "1");
          forceFreshLoad = true;
        } else if (!sessionChecked) {
          // Mark session checked so we don't repeat the long-inactivity check in this tab instance
          sessionStorage.setItem(SESSION_CHECK_KEY, "1");
        }
      }

      // Try cache (ONLY if not a fresh session requiring absolute sync)
      if (!forceFreshLoad) {
        const cached = storage.getItem(cacheKey);
        if (cached) {
          try {
            const { timestamp, data } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age < CACHE_DURATION) {
              if (mounted) {
                setManifestData(data);
                setIsLoading(false);
              }
              return;
            }
          } catch {
            // Ignore cache parse errors
          }
        }
      }

      // No valid cache, fetch from storage
      setIsFetching(true);
      const fetched = await fetchManifest();

      if (mounted) {
        if (fetched) {
          setManifestData(fetched);
        }
        setIsLoading(false);
        setIsFetching(false);
      }
    };

    load();

    // Listen for background refresh events from SessionCacheManager
    const handleBackgroundRefresh = () => {
      console.log("[useDbManifest] Background refresh triggered via event");
      void fetchManifest();
    };
    window.addEventListener("manifest:background-refresh", handleBackgroundRefresh);

    return () => {
      mounted = false;
      window.removeEventListener("manifest:background-refresh", handleBackgroundRefresh);
    };
  }, [isAdminSession]);

  // Background refresh - check for updates immediately after initial load
  useEffect(() => {
    if (!manifestData || isFetching) return;

    const checkForUpdates = async () => {
      const fetched = await fetchManifest();
      if (fetched) {
        // 1. Check for app_version change first (hard reset)
        const localVersion = localStorage.getItem(APP_VERSION_KEY);
        if (localVersion && fetched.app_version && localVersion !== fetched.app_version) {
          selfDestructAndReload(fetched.app_version);
          return;
        }

        // 2. Otherwise update version key if it was missing
        if (fetched.app_version) {
          localStorage.setItem(APP_VERSION_KEY, fetched.app_version);
        }

        // 3. Check for softer data update
        if (fetched.generated_at !== manifestData.generated_at) {
          console.log("[useDbManifest] New manifest version detected, updating...");
          setManifestData(fetched);
        }
      }
    };

    // Check immediately, no delay
    checkForUpdates();
  }, [manifestData?.generated_at, isFetching]);

  // Build lookup maps from manifest
  const { metaByKey, availabilityById, items } = useMemo(() => {
    if (!manifestData) {
      return {
        metaByKey: new Map<string, ManifestMetadata>(),
        availabilityById: new Map<string, ManifestAvailability>(),
        items: [] as ManifestItem[],
      };
    }

    const metaByKey = new Map<string, ManifestMetadata>();
    const availabilityById = new Map<string, ManifestAvailability>();

    manifestData.items.forEach((item) => {
      const key = `${item.id}-${item.media_type}`;

      metaByKey.set(key, {
        genreIds: item.genre_ids,
        releaseYear: item.release_year,
        title: item.title,
        originalLanguage: item.original_language,
        originCountry: item.origin_country,
        posterUrl: item.poster_url,
        backdropUrl: item.backdrop_url,
        logoUrl: item.logo_url,
        voteAverage: item.vote_average,
        voteCount: item.vote_count,
      });

      // Use composite key (id-mediaType) to prevent movie/tv collisions
      availabilityById.set(key, {
        hasWatch: item.hasWatch,
        hasDownload: item.hasDownload,
        hoverImageUrl: item.hover_image_url,
        logoUrl: item.logo_url,
        voteAverage: item.vote_average,
      });
    });

    return { metaByKey, availabilityById, items: manifestData.items };
  }, [manifestData]);

  const isInManifest = (tmdbId: number, mediaType: "movie" | "tv") => {
    return metaByKey.has(`${tmdbId}-${mediaType}`);
  };

  const getManifestMeta = (tmdbId: number, mediaType: "movie" | "tv") => {
    return metaByKey.get(`${tmdbId}-${mediaType}`) || null;
  };

  const getManifestMetaByKey = (key: string) => {
    const meta = metaByKey.get(key);
    return meta ? { release_year: meta.releaseYear } : null;
  };

  return {
    manifest: manifestData,
    items,
    metaByKey,
    availabilityById,
    isInManifest,
    getManifestMeta,
    getManifestMetaByKey,
    isLoading: isLoading || isFetching,
  };
};
