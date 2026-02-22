import { useCallback, useMemo } from "react";
import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useDbManifest } from "@/hooks/useDbManifest";
import type { Movie } from "@/lib/tmdb";

/**
 * Central content access policy hook.
 *
 * Non-admin users can only see content that exists in the Supabase database
 * manifest. Admins see everything (TMDB + DB).
 */
export const useContentAccess = () => {
    const { isAdmin, isLoading: isAdminLoading } = useAdminStatus();
    const { isInManifest, isLoading: isManifestLoading } = useDbManifest();

    /** True while admin status or manifest are still loading. */
    const isLoading = isAdminLoading || isManifestLoading;

    /**
     * Filter an array of Movie items.
     * Non-admins keep only items that exist in the DB manifest.
     * Admins keep all items.
     */
    const filterForRole = useCallback(
        (items: Movie[]): Movie[] => {
            if (isAdmin) return items;
            return items.filter((m) => {
                const mediaType =
                    (m.media_type as "movie" | "tv") ??
                    (m.first_air_date ? "tv" : "movie");
                return isInManifest(m.id, mediaType);
            });
        },
        [isAdmin, isInManifest]
    );

    /**
     * Check if a single item is accessible to the current user.
     * Admins always have access; non-admins need the item in the manifest.
     */
    const isAccessible = useCallback(
        (id: number, mediaType: "movie" | "tv"): boolean => {
            if (isAdmin) return true;
            return isInManifest(id, mediaType);
        },
        [isAdmin, isInManifest]
    );

    return useMemo(
        () => ({ filterForRole, isAccessible, isAdmin, isLoading }),
        [filterForRole, isAccessible, isAdmin, isLoading]
    );
};
