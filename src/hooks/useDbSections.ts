import { useMemo } from "react";
import { useDbManifest, ManifestItem } from "./useDbManifest";
import type { Movie } from "@/lib/tmdb";

interface SectionConfig {
  id: string;
  title: string;
  filter: (item: ManifestItem) => boolean;
  limit: number;
}

// TMDB Genre IDs reference:
// Action: 28 (movie), 10759 (tv)
// Comedy: 35
// Thriller: 53, Crime: 80, Mystery: 9648
// Sci-Fi: 878 (movie), 10765 (tv), Fantasy: 14
// Drama: 18

const SECTION_CONFIGS: SectionConfig[] = [
  {
    id: "new",
    title: "Just Added",
    filter: (item) => (item.release_year ?? 0) >= 2024,
    limit: 20,
  },
  {
    id: "favorites",
    title: "Fan Favorites",
    filter: (item) => (item.vote_average ?? 0) >= 8.0,
    limit: 20,
  },
  {
    id: "action",
    title: "Action",
    filter: (item) => item.genre_ids.some((g) => [28, 10759].includes(g)),
    limit: 15,
  },
  {
    id: "comedy",
    title: "Comedy",
    filter: (item) => item.genre_ids.includes(35),
    limit: 15,
  },
  {
    id: "thriller",
    title: "Thriller",
    filter: (item) => item.genre_ids.some((g) => [53, 80, 9648].includes(g)),
    limit: 15,
  },
  {
    id: "scifi",
    title: "Sci-Fi",
    filter: (item) => item.genre_ids.some((g) => [878, 14, 10765].includes(g)),
    limit: 15,
  },
  {
    id: "drama",
    title: "Drama",
    filter: (item) => item.genre_ids.includes(18),
    limit: 15,
  },
  {
    id: "series",
    title: "Series to Binge",
    filter: (item) => item.media_type === "tv",
    limit: 15,
  },
  {
    id: "movies",
    title: "Movie Night",
    filter: (item) => item.media_type === "movie",
    limit: 15,
  },
];

/** Convert ManifestItem to Movie type for rendering in ContentRow */
const manifestToMovie = (item: ManifestItem): Movie => ({
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

export interface DbSection {
  id: string;
  title: string;
  items: Movie[];
}

export const useDbSections = () => {
  const { items, isLoading } = useDbManifest();

  const sections = useMemo<DbSection[]>(() => {
    if (!items || items.length === 0) return [];

    // Track used item IDs to avoid duplicates across sections
    const usedIds = new Set<string>();

    return SECTION_CONFIGS.map((config) => {
      const filtered = items
        .filter((item) => {
          const key = `${item.id}-${item.media_type}`;
          if (usedIds.has(key)) return false;
          return config.filter(item);
        })
        .sort((a, b) => {
          // Sort by release year descending (newest first)
          const yearA = a.release_year ?? new Date().getFullYear();
          const yearB = b.release_year ?? new Date().getFullYear();
          if (yearB !== yearA) return yearB - yearA;
          // Secondary sort by rating
          return (b.vote_average ?? 0) - (a.vote_average ?? 0);
        })
        .slice(0, config.limit);

      // Mark as used
      filtered.forEach((item) => {
        usedIds.add(`${item.id}-${item.media_type}`);
      });

      return {
        id: config.id,
        title: config.title,
        items: filtered.map(manifestToMovie),
      };
    }).filter((section) => section.items.length >= 5); // Only show sections with enough content
  }, [items]);

  return { sections, isLoading };
};
