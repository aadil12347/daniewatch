import { useCallback, useMemo } from "react";
import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useDbManifest } from "@/hooks/useDbManifest";
import type { Movie } from "@/lib/tmdb";
import { filterItemsForUser, canUserSeeItem, isItemInDatabase } from "@/lib/contentVisibility";

/**
 * Central content access policy hook.
 *
 * Non-admin users can only see content that exists in the Supabase database
 * manifest. Admins see everything (TMDB + DB).
 * 
 * Uses the centralized contentVisibility policy for consistent behavior.
 */
export const useContentAccess = () => {
    const { isAdmin, isLoading: isAdminLoading } = useAdminStatus();
    const { metaByKey, isLoading: isManifestLoading } = useDbManifest();

    /** True while admin status or manifest are still loading. */
    const isLoading = isAdminLoading || isManifestLoading;

    /**
     * Filter an array of Movie items.
     * Non-admins keep only items that exist in the DB manifest.
     * Admins keep all items.
     */
    const filterForRole = useCallback(
        (items: Movie[]): Movie[] => {
            return filterItemsForUser(items, {
                isAdmin,
                dbIndex: metaByKey
            });
        },
        [isAdmin, metaByKey]
    );

    /**
     * Check if a single item is accessible to the current user.
     * Admins always have access; non-admins need the item in the manifest.
     */
    const isAccessible = useCallback(
        (id: number, mediaType: "movie" | "tv"): boolean => {
            return canUserSeeItem(
                { id, media_type: mediaType },
                { isAdmin, dbIndex: metaByKey }
            );
        },
        [isAdmin, metaByKey]
    );

    /**
     * Check if an item exists in the database (for detail route guards).
     */
    const isInDatabase = useCallback(
        (id: number, mediaType: "movie" | "tv"): boolean => {
            return isItemInDatabase(id, mediaType, metaByKey);
        },
        [metaByKey]
    );

    return useMemo(
        () => ({ filterForRole, isAccessible, isInDatabase, isAdmin, isLoading }),
        [filterForRole, isAccessible, isInDatabase, isAdmin, isLoading]
    );
};
