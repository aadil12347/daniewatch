import { useMemo } from "react";
import { useDbManifest, ManifestItem } from "./useDbManifest";
import type { Movie } from "@/lib/tmdb";

/**
 * Convert ManifestItem to Movie type for rendering
 */
const manifestItemToMovie = (item: ManifestItem): Movie => ({
    id: item.id,
    title: item.title || "",
    name: item.title || "",
    overview: "",
    poster_path: item.poster_url,
    backdrop_path: item.backdrop_url,
    logo_url: item.logo_url,
    vote_average: item.vote_average ?? 0,
    vote_count: item.vote_count ?? 0,
    genre_ids: item.genre_ids,
    media_type: item.media_type,
    release_date: item.release_year ? `${item.release_year}-01-01` : undefined,
    first_air_date: item.release_year ? `${item.release_year}-01-01` : undefined,
});

/**
 * Hook to get trending posts from the database.
 * 
 * This returns the top 10 items from the database manifest, sorted by:
 * 1. Release year (newest first)
 * 2. Vote average (highest first)
 * 
 * The list is "frozen" daily - it only changes when the admin updates
 * the manifest or when new items are added to the database.
 */
export const useTrendingFromDb = () => {
    const { items, isLoading } = useDbManifest();

    const trendingItems = useMemo<Movie[]>(() => {
        if (!items || items.length === 0) return [];

        // Sort by release year (newest first), then by vote average (highest first)
        const sorted = [...items].sort((a, b) => {
            const yearA = a.release_year ?? 0;
            const yearB = b.release_year ?? 0;
            if (yearB !== yearA) return yearB - yearA;
            return (b.vote_average ?? 0) - (a.vote_average ?? 0);
        });

        // Take top 10 items
        const top10 = sorted.slice(0, 10);

        return top10.map(manifestItemToMovie);
    }, [items]);

    return {
        trendingItems,
        isLoading,
        hasEnoughItems: trendingItems.length >= 10,
    };
};

/**
 * Hook to get minimum 10 items for carousel sections from database.
 * If the filtered items are less than 10, it returns empty array (section won't render).
 */
export const useMinTenItems = <T extends Movie>(
    items: T[],
    minCount: number = 10
): T[] => {
    return useMemo(() => {
        if (items.length >= minCount) {
            return items;
        }
        // Return empty array if not enough items - section won't render
        return [];
    }, [items, minCount]);
};
