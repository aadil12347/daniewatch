/**
 * Centralized Content Visibility Policy
 * 
 * Rules:
 * - Non-admin users can ONLY see DB-backed items (items in the Supabase manifest)
 * - Admin users can see ALL items (TMDB + DB)
 * - TMDB-only items are hidden from non-admins on all pages/search/details
 */

import type { Movie } from "@/lib/tmdb";
import type { ManifestItem } from "@/hooks/useDbManifest";

/**
 * Check if admin view is enabled (admin users can see TMDB+DB content)
 */
export const isAdminViewEnabled = (isAdmin: boolean): boolean => isAdmin;

// In-memory set of externally resolved/allowed items
const externalAllowedSet = new Set<string>();

/**
 * Mark a movie/show ID as allowed (e.g. resolved from VegaMovies or RogMovies)
 */
export const markExternalAllowed = (id: number | string): void => {
    externalAllowedSet.add(String(id));
    if (typeof window !== "undefined") {
        try {
            window.sessionStorage.setItem(`external_allowed_${id}`, "1");
        } catch {
            // ignore
        }
    }
};

/**
 * Check if an item is marked as externally allowed
 */
export const isExternalAllowed = (id: number | string): boolean => {
    if (externalAllowedSet.has(String(id))) return true;
    if (typeof window !== "undefined") {
        try {
            return window.sessionStorage.getItem(`external_allowed_${id}`) === "1";
        } catch {
            // ignore
        }
    }
    return false;
};

/**
 * Check if an item exists in the DB manifest or is an allowed external item
 */
export const isDbBackedItem = (
    item: { id: number; media_type?: string; origin_site?: string; post_url?: string },
    dbIndex: Map<string, unknown>
): boolean => {
    // VegaMovies / RogMovies posts are always visible
    if ((item as any).origin_site || (item as any).post_url) return true;
    if (isExternalAllowed(item.id)) return true;

    const mediaType = item.media_type ?? "movie";
    const key = `${item.id}-${mediaType}`;
    return dbIndex.has(key);
};

/**
 * Check if a user can see a specific item
 * - Admins can see everything
 * - Non-admins can see DB-backed items and Vega/Rog posts
 */
export const canUserSeeItem = (
    item: { id: number; media_type?: string; origin_site?: string; post_url?: string },
    options: { isAdmin: boolean; dbIndex: Map<string, unknown> }
): boolean => {
    // Admins see everything
    if (options.isAdmin) return true;

    // Check DB manifest or external allowance
    return isDbBackedItem(item, options.dbIndex);
};

/**
 * Filter an array of items based on user role
 * - Admins see all items
 * - Non-admins see DB-backed and external items
 */
export const filterItemsForUser = <T extends { id: number; media_type?: string; origin_site?: string; post_url?: string }>(
    items: T[],
    options: { isAdmin: boolean; dbIndex: Map<string, unknown> }
): T[] => {
    // Admins see everything
    if (options.isAdmin) return items;

    // Non-admins see DB-backed and external items
    return items.filter((item) => isDbBackedItem(item, options.dbIndex));
};

/**
 * Filter Movie[] items for non-admin users
 * Optimized for the common Movie type used throughout the app
 */
export const filterMoviesForUser = (
    movies: Movie[],
    options: { isAdmin: boolean; dbIndex: Map<string, unknown> }
): Movie[] => {
    return filterItemsForUser(movies, options);
};

/**
 * Create a DB index from manifest items for fast lookup
 */
export const createDbIndex = (manifestItems: ManifestItem[]): Map<string, ManifestItem> => {
    const index = new Map<string, ManifestItem>();
    for (const item of manifestItems) {
        const key = `${item.id}-${item.media_type}`;
        index.set(key, item);
    }
    return index;
};

/**
 * Check if a TMDB ID exists in the database (for detail route guards)
 */
export const isItemInDatabase = (
    tmdbId: number,
    mediaType: "movie" | "tv",
    dbIndex: Map<string, unknown>
): boolean => {
    if (isExternalAllowed(tmdbId)) return true;
    const key = `${tmdbId}-${mediaType}`;
    return dbIndex.has(key);
};

/**
 * Deduplicate items by id+media_type, preserving first occurrence
 */
export const dedupeItems = <T extends { id: number; media_type?: string }>(
    items: T[]
): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const item of items) {
        const mediaType = item.media_type ?? "movie";
        const key = `${item.id}-${mediaType}`;

        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }

    return result;
};

/**
 * Merge DB items with TMDB items, with DB items taking priority
 * Used for search results where DB matches should appear first
 */
export const mergeDbAndTmdbItems = <T extends { id: number; media_type?: string }>(
    dbItems: T[],
    tmdbItems: T[],
    options: { isAdmin: boolean; dbIndex: Map<string, unknown> }
): T[] => {
    // For non-admins, only show DB items
    if (!options.isAdmin) {
        return dedupeItems(dbItems);
    }

    // For admins, merge both with DB items first
    const dbKeys = new Set(dbItems.map((item) => `${item.id}-${item.media_type ?? "movie"}`));
    const filteredTmdb = tmdbItems.filter(
        (item) => !dbKeys.has(`${item.id}-${item.media_type ?? "movie"}`)
    );

    return dedupeItems([...dbItems, ...filteredTmdb]);
};
