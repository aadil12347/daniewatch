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

/**
 * Check if an item exists in the DB manifest
 */
export const isDbBackedItem = (
    item: { id: number; media_type?: string },
    dbIndex: Map<string, unknown>
): boolean => {
    const mediaType = item.media_type ?? "movie";
    const key = `${item.id}-${mediaType}`;
    return dbIndex.has(key);
};

/**
 * Check if a user can see a specific item
 * - Admins can see everything
 * - Non-admins can only see DB-backed items
 */
export const canUserSeeItem = (
    item: { id: number; media_type?: string },
    options: { isAdmin: boolean; dbIndex: Map<string, unknown> }
): boolean => {
    // Admins see everything
    if (options.isAdmin) return true;

    // Non-admins only see DB-backed items
    return isDbBackedItem(item, options.dbIndex);
};

/**
 * Filter an array of items based on user role
 * - Admins see all items
 * - Non-admins only see DB-backed items
 */
export const filterItemsForUser = <T extends { id: number; media_type?: string }>(
    items: T[],
    options: { isAdmin: boolean; dbIndex: Map<string, unknown> }
): T[] => {
    // Admins see everything
    if (options.isAdmin) return items;

    // Non-admins only see DB-backed items
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
