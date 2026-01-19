import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EntryAvailability {
  hasWatch: boolean;
  hasDownload: boolean;
  hoverImageUrl?: string | null;
}

export interface EntryDbMeta {
  genreIds?: number[] | null;
  releaseYear?: number | null;
  title?: string | null;
  type: "movie" | "series";
  originalLanguage?: string | null;
  originCountry?: string[] | null;
}

interface MovieContent {
  watch_link?: string;
  download_link?: string;
}

interface SeriesSeasonContent {
  watch_links?: string[];
  download_links?: string[];
}

interface SeriesContent {
  [key: string]: SeriesSeasonContent;
}

interface EntryData {
  id: string;
  type: "movie" | "series";
  content: MovieContent | SeriesContent;
  hover_image_url?: string | null;
  genre_ids?: number[] | null;
  release_year?: number | null;
  title?: string | null;
  original_language?: string | null;
  origin_country?: string[] | null;
}

const getEntryKey = (id: string, type: "movie" | "series") => `${id}-${type === "series" ? "tv" : "movie"}`;

export const useEntryAvailability = () => {
  const {
    data = {
      availabilityById: new Map<string, EntryAvailability>(),
      metaByKey: new Map<string, EntryDbMeta>(),
      entries: [] as EntryData[],
    },
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["entry-availability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id, type, content, hover_image_url, genre_ids, release_year, title, original_language, origin_country");

      if (error) {
        console.error("[useEntryAvailability] Error fetching entries:", error);
        return {
          availabilityById: new Map<string, EntryAvailability>(),
          metaByKey: new Map<string, EntryDbMeta>(),
          entries: [] as EntryData[],
        };
      }

      const availabilityById = new Map<string, EntryAvailability>();
      const metaByKey = new Map<string, EntryDbMeta>();
      const entries = (data as EntryData[] | null | undefined) ?? [];

      entries.forEach((entry) => {
        let hasWatch = false;
        let hasDownload = false;

        if (entry.type === "movie") {
          const content = entry.content as MovieContent;
          hasWatch = !!(content.watch_link && content.watch_link.trim());
          hasDownload = !!(content.download_link && content.download_link.trim());
        } else if (entry.type === "series") {
          const content = entry.content as SeriesContent;
          Object.keys(content).forEach((key) => {
            if (!key.startsWith("season_")) return;
            const season = content[key];
            if (season.watch_links?.some((link) => link && link.trim())) hasWatch = true;
            if (season.download_links?.some((link) => link && link.trim())) hasDownload = true;
          });
        }

        availabilityById.set(entry.id, {
          hasWatch,
          hasDownload,
          hoverImageUrl: entry.hover_image_url ?? null,
        });

        metaByKey.set(getEntryKey(entry.id, entry.type), {
          type: entry.type,
          genreIds: entry.genre_ids ?? null,
          releaseYear: entry.release_year ?? null,
          title: entry.title ?? null,
          originalLanguage: entry.original_language ?? null,
          originCountry: entry.origin_country ?? null,
        });
      });

      return { availabilityById, metaByKey, entries };
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const getAvailability = (tmdbId: number): EntryAvailability => {
    return data.availabilityById.get(String(tmdbId)) || { hasWatch: false, hasDownload: false, hoverImageUrl: null };
  };

  const getHoverImageUrl = (tmdbId: number): string | null => {
    const val = data.availabilityById.get(String(tmdbId))?.hoverImageUrl;
    return val?.trim?.() ? val : null;
  };

  const isInDb = (tmdbId: number, mediaType: "movie" | "tv") => {
    return data.metaByKey.has(`${tmdbId}-${mediaType}`);
  };

  const getDbMeta = (tmdbId: number, mediaType: "movie" | "tv") => {
    const meta = data.metaByKey.get(`${tmdbId}-${mediaType}`);
    return meta
      ? {
          genreIds: meta.genreIds ?? null,
          releaseYear: meta.releaseYear ?? null,
          title: meta.title ?? null,
          type: meta.type,
          originalLanguage: meta.originalLanguage ?? null,
          originCountry: meta.originCountry ?? null,
        }
      : null;
  };

  const getDbMetaByKey = (key: string) => {
    const meta = data.metaByKey.get(key);
    return meta ? { release_year: meta.releaseYear ?? null } : null;
  };

  return {
    // existing API
    getAvailability,
    getHoverImageUrl,
    availabilityMap: data.availabilityById,

    // new API (non-breaking add-ons)
    entries: data.entries,
    metaByKey: data.metaByKey,
    isInDb,
    getDbMeta,
    getDbMetaByKey,

    isLoading: isLoading || isFetching,
  };
};
