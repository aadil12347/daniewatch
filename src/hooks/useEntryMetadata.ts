import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EpisodeMetadata {
  id?: string;
  entry_id: string;
  season_number: number;
  episode_number: number;
  name: string | null;
  overview: string | null;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number | null;
  admin_edited: boolean;
}

export interface SaveEpisodeInput {
  episode_number: number;
  name: string | null;
  overview: string | null;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number | null;
  admin_edited?: boolean;
}

export const useEntryMetadata = () => {
  const { toast } = useToast();

  // Fetch all episodes for a given entry and season
  const fetchEpisodeMetadata = async (
    entryId: string,
    seasonNumber: number
  ): Promise<EpisodeMetadata[]> => {
    try {
      const { data, error } = await supabase
        .from("entry_metadata")
        .select("*")
        .eq("entry_id", entryId)
        .eq("season_number", seasonNumber)
        .order("episode_number", { ascending: true });

      if (error) throw error;
      return (data || []) as EpisodeMetadata[];
    } catch (error) {
      console.error("Error fetching episode metadata:", error);
      return [];
    }
  };

  // Fetch all episodes for an entry (all seasons)
  const fetchAllEpisodeMetadata = async (
    entryId: string
  ): Promise<EpisodeMetadata[]> => {
    try {
      const { data, error } = await supabase
        .from("entry_metadata")
        .select("*")
        .eq("entry_id", entryId)
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true });

      if (error) throw error;
      return (data || []) as EpisodeMetadata[];
    } catch (error) {
      console.error("Error fetching all episode metadata:", error);
      return [];
    }
  };

  // Save/update episodes for a season (upsert)
  const saveEpisodeMetadata = async (
    entryId: string,
    seasonNumber: number,
    episodes: SaveEpisodeInput[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const records = episodes.map((ep) => ({
        entry_id: entryId,
        season_number: seasonNumber,
        episode_number: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        still_path: ep.still_path,
        air_date: ep.air_date,
        runtime: ep.runtime,
        vote_average: ep.vote_average,
        admin_edited: ep.admin_edited ?? false,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("entry_metadata")
        .upsert(records, {
          onConflict: "entry_id,season_number,episode_number",
        });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error("Error saving episode metadata:", error);
      return { success: false, error: error.message };
    }
  };

  // Save a single episode
  const saveSingleEpisode = async (
    entryId: string,
    seasonNumber: number,
    episode: SaveEpisodeInput
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from("entry_metadata").upsert(
        {
          entry_id: entryId,
          season_number: seasonNumber,
          episode_number: episode.episode_number,
          name: episode.name,
          overview: episode.overview,
          still_path: episode.still_path,
          air_date: episode.air_date,
          runtime: episode.runtime,
          vote_average: episode.vote_average,
          admin_edited: episode.admin_edited ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entry_id,season_number,episode_number" }
      );

      if (error) throw error;

      toast({
        title: "Episode Saved",
        description: `Episode ${episode.episode_number} updated successfully.`,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error saving episode:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save episode.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  // Mark an entry as admin edited
  const markEntryAdminEdited = async (
    entryId: string,
    edited: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from("entries")
        .update({ admin_edited: edited })
        .eq("id", entryId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error("Error marking entry as admin edited:", error);
      return { success: false, error: error.message };
    }
  };

  // Delete episode metadata for a season
  const deleteSeasonMetadata = async (
    entryId: string,
    seasonNumber: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from("entry_metadata")
        .delete()
        .eq("entry_id", entryId)
        .eq("season_number", seasonNumber);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting season metadata:", error);
      return { success: false, error: error.message };
    }
  };

  // Delete all episode metadata for an entry
  const deleteAllMetadata = async (
    entryId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from("entry_metadata")
        .delete()
        .eq("entry_id", entryId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting all metadata:", error);
      return { success: false, error: error.message };
    }
  };

  return {
    fetchEpisodeMetadata,
    fetchAllEpisodeMetadata,
    saveEpisodeMetadata,
    saveSingleEpisode,
    markEntryAdminEdited,
    deleteSeasonMetadata,
    deleteAllMetadata,
  };
};
