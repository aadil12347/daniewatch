import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MovieContent {
  watch_link: string;
  download_link: string;
}

interface SeriesSeasonContent {
  watch_links: string[];
  download_links: string[];
}

interface SeriesContent {
  [key: string]: SeriesSeasonContent;
}

// Extended metadata fields for entries table
export type EntryMediaFields = {
  poster_url?: string | null;
  backdrop_url?: string | null;
  logo_url?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  media_updated_at?: string | null;
  // Extended metadata
  overview?: string | null;
  tagline?: string | null;
  runtime?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  status?: string | null;
  genres?: { id: number; name: string }[] | null;
  cast_data?: { id: number; name: string; character: string; profile_path: string | null }[] | null;
};

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface Genre {
  id: number;
  name: string;
}

export interface EntryData {
  id: string;
  type: "movie" | "series";
  content: MovieContent | SeriesContent;
  title?: string | null;
  hover_image_url?: string | null;
  genre_ids?: number[] | null;
  release_year?: number | null;
  original_language?: string | null;
  origin_country?: string[] | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  logo_url?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  media_updated_at?: string | null;
  created_at?: string;
  // Complete metadata fields
  overview?: string | null;
  tagline?: string | null;
  runtime?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  status?: string | null;
  genres?: Genre[] | null;
  cast_data?: CastMember[] | null;
  admin_edited?: boolean;
}

export const useEntries = () => {
  const { toast } = useToast();

  // Fetch single entry by TMDB ID
  const fetchEntry = async (id: string): Promise<EntryData | null> => {
    try {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows found
          return null;
        }
        throw error;
      }

      return data as EntryData;
    } catch (error) {
      console.error("Error fetching entry:", error);
      return null;
    }
  };

  // Save movie entry
  const saveMovieEntry = async (
    id: string,
    watchLink: string,
    downloadLink: string,
    hoverImageUrl?: string,
    genreIds?: number[],
    releaseYear?: number | null,
    title?: string | null,
    originalLanguage?: string | null,
    originCountry?: string[] | null,
    media?: EntryMediaFields
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const content: MovieContent = {
        watch_link: watchLink.trim(),
        download_link: downloadLink.trim(),
      };

      const hover_image_url = hoverImageUrl?.trim() ? hoverImageUrl.trim() : null;
      const normalizedTitle = title?.trim() ? title.trim() : null;

      const { error } = await supabase.from("entries").upsert({
        id,
        type: "movie",
        content,
        title: normalizedTitle,
        hover_image_url,
        genre_ids: genreIds?.length ? genreIds : null,
        release_year: typeof releaseYear === "number" ? releaseYear : null,
        original_language: originalLanguage || null,
        origin_country: originCountry?.length ? originCountry : null,
        ...(media ?? {}),
      });

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Movie links have been saved successfully.",
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error saving movie entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save movie links.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  // Save series season entry (upsert)
  const saveSeriesSeasonEntry = async (
    id: string,
    season: number,
    watchLinks: string[],
    downloadLinks: string[],
    hoverImageUrl?: string,
    genreIds?: number[],
    releaseYear?: number | null,
    title?: string | null,
    originalLanguage?: string | null,
    originCountry?: string[] | null,
    media?: EntryMediaFields
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // First, fetch existing entry to merge seasons
      const existing = await fetchEntry(id);

      const seasonKey = `season_${season}`;
      const seasonData: SeriesSeasonContent = {
        watch_links: watchLinks.map((l) => l.trim()).filter((l) => l),
        download_links: downloadLinks.map((l) => l.trim()).filter((l) => l),
      };

      let content: SeriesContent;

      if (existing && existing.type === "series") {
        // Merge with existing seasons
        content = {
          ...(existing.content as SeriesContent),
          [seasonKey]: seasonData,
        };
      } else {
        // Create new series entry
        content = {
          [seasonKey]: seasonData,
        };
      }

      const hover_image_url = hoverImageUrl?.trim() ? hoverImageUrl.trim() : null;
      const normalizedTitle = title?.trim() ? title.trim() : null;

      const { error } = await supabase.from("entries").upsert({
        id,
        type: "series",
        content,
        title: normalizedTitle,
        hover_image_url,
        genre_ids: genreIds?.length ? genreIds : null,
        release_year: typeof releaseYear === "number" ? releaseYear : null,
        original_language: originalLanguage || null,
        origin_country: originCountry?.length ? originCountry : null,
        ...(media ?? {}),
      });

      if (error) throw error;

      toast({
        title: "Saved",
        description: `Season ${season} links have been saved successfully.`,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error saving series entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save series links.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  // Delete entire entry
  const deleteEntry = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Entry has been deleted successfully.",
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete entry.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  // Delete single season from series
  const deleteSeasonFromEntry = async (
    id: string,
    season: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const existing = await fetchEntry(id);
      
      if (!existing || existing.type !== "series") {
        return { success: false, error: "Entry not found or not a series" };
      }

      const content = existing.content as SeriesContent;
      const seasonKey = `season_${season}`;
      
      if (!content[seasonKey]) {
        return { success: false, error: "Season not found" };
      }

      delete content[seasonKey];

      // Check if any seasons remain
      const remainingSeasons = Object.keys(content).filter(k => k.startsWith("season_"));
      
      if (remainingSeasons.length === 0) {
        // Delete entire entry if no seasons remain
        return deleteEntry(id);
      }

      const { error } = await supabase
        .from("entries")
        .update({ content })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `Season ${season} has been deleted.`,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error deleting season:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete season.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  return {
    fetchEntry,
    saveMovieEntry,
    saveSeriesSeasonEntry,
    deleteEntry,
    deleteSeasonFromEntry,
  };
};
