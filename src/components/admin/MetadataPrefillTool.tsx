import { useState, useRef } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle, SkipForward, Database } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getMovieDetails,
  getMovieImages,
  getTVDetails,
  getTVImages,
  getTVSeasonDetails,
  getImageUrl,
} from "@/lib/tmdb";

interface PrefillStats {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1500;
const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 3;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pickLogoUrl = (logos: { file_path: string; iso_639_1: string | null }[] | undefined) => {
  if (!logos?.length) return null;
  const preferred =
    logos.find((l) => l.iso_639_1 === "en") ??
    logos.find((l) => l.iso_639_1 == null) ??
    logos[0];
  return getImageUrl(preferred?.file_path ?? null, "w500");
};

export function MetadataPrefillTool() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<PrefillStats | null>(null);
  const [currentEntry, setCurrentEntry] = useState<string | null>(null);
  const abortRef = useRef(false);

  const fetchWithRetry = async <T,>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES
  ): Promise<T | null> => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        if (error?.message?.includes("429") || error?.message?.includes("rate")) {
          await delay(RETRY_DELAY_MS * (i + 1));
          continue;
        }
        throw error;
      }
    }
    return null;
  };

  const prefillMovieEntry = async (entryId: string) => {
    const [details, images] = await Promise.all([
      fetchWithRetry(() => getMovieDetails(Number(entryId))),
      fetchWithRetry(() => getMovieImages(Number(entryId))),
    ]);

    if (!details) return false;

    const { error } = await supabase
      .from("entries")
      .update({
        title: details.title || null,
        poster_url: getImageUrl(details.poster_path, "w342"),
        backdrop_url: getImageUrl(details.backdrop_path, "original"),
        logo_url: pickLogoUrl(images?.logos),
        vote_average: details.vote_average ?? null,
        vote_count: (details as any).vote_count ?? null,
        overview: details.overview || null,
        tagline: details.tagline || null,
        runtime: details.runtime || null,
        genre_ids: details.genres?.map((g) => g.id) || null,
        release_year: details.release_date
          ? Number(details.release_date.split("-")[0])
          : null,
        original_language: details.original_language || null,
        origin_country: details.production_countries?.map((c) => c.iso_3166_1) || null,
        media_updated_at: new Date().toISOString(),
      })
      .eq("id", entryId);

    return !error;
  };

  const prefillSeriesEntry = async (entryId: string) => {
    const [details, images] = await Promise.all([
      fetchWithRetry(() => getTVDetails(Number(entryId))),
      fetchWithRetry(() => getTVImages(Number(entryId))),
    ]);

    if (!details) return false;

    // Update main entry
    const { error: entryError } = await supabase
      .from("entries")
      .update({
        title: details.name || null,
        poster_url: getImageUrl(details.poster_path, "w342"),
        backdrop_url: getImageUrl(details.backdrop_path, "original"),
        logo_url: pickLogoUrl(images?.logos),
        vote_average: details.vote_average ?? null,
        vote_count: (details as any).vote_count ?? null,
        overview: details.overview || null,
        tagline: details.tagline || null,
        number_of_seasons: details.number_of_seasons || null,
        genre_ids: details.genres?.map((g) => g.id) || null,
        release_year: details.first_air_date
          ? Number(details.first_air_date.split("-")[0])
          : null,
        original_language: details.original_language || null,
        origin_country: details.origin_country || null,
        media_updated_at: new Date().toISOString(),
      })
      .eq("id", entryId);

    if (entryError) return false;

    // Fetch and save episode metadata for all seasons
    const validSeasons = details.seasons?.filter((s) => s.season_number > 0) || [];

    for (const season of validSeasons) {
      if (abortRef.current) break;

      try {
        const seasonDetails = await fetchWithRetry(() =>
          getTVSeasonDetails(Number(entryId), season.season_number)
        );

        if (!seasonDetails?.episodes?.length) continue;

        // Check which episodes already have admin_edited = true
        const { data: existingEpisodes } = await supabase
          .from("entry_metadata")
          .select("episode_number, admin_edited")
          .eq("entry_id", entryId)
          .eq("season_number", season.season_number);

        const adminEditedEpisodes = new Set(
          (existingEpisodes || [])
            .filter((e) => e.admin_edited)
            .map((e) => e.episode_number)
        );

        // Filter out admin-edited episodes
        const episodesToUpdate = seasonDetails.episodes.filter(
          (ep) => !adminEditedEpisodes.has(ep.episode_number)
        );

        if (episodesToUpdate.length === 0) continue;

        const records = episodesToUpdate.map((ep) => ({
          entry_id: entryId,
          season_number: season.season_number,
          episode_number: ep.episode_number,
          name: ep.name || null,
          overview: ep.overview || null,
          still_path: ep.still_path ? getImageUrl(ep.still_path, "w300") : null,
          air_date: ep.air_date || null,
          runtime: ep.runtime || null,
          vote_average: ep.vote_average ?? null,
          admin_edited: false,
          updated_at: new Date().toISOString(),
        }));

        await supabase
          .from("entry_metadata")
          .upsert(records, { onConflict: "entry_id,season_number,episode_number" });

        await delay(300); // Small delay between seasons
      } catch (err) {
        console.error(`Error fetching season ${season.season_number}:`, err);
      }
    }

    return true;
  };

  const runPrefill = async () => {
    setIsRunning(true);
    abortRef.current = false;

    try {
      // Fetch all entries where admin_edited is false or null
      const { data: entries, error } = await supabase
        .from("entries")
        .select("id, type, admin_edited")
        .or("admin_edited.is.null,admin_edited.eq.false");

      if (error) throw error;
      if (!entries?.length) {
        toast({
          title: "No entries to prefill",
          description: "All entries are either admin-edited or no entries exist.",
        });
        setIsRunning(false);
        return;
      }

      const initialStats: PrefillStats = {
        total: entries.length,
        processed: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      };
      setStats(initialStats);

      // Process in batches
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        if (abortRef.current) break;

        const batch = entries.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (entry) => {
            if (abortRef.current) return;

            setCurrentEntry(`${entry.id} (${entry.type})`);

            try {
              let success = false;
              if (entry.type === "movie") {
                success = await prefillMovieEntry(entry.id);
              } else if (entry.type === "series") {
                success = await prefillSeriesEntry(entry.id);
              }

              setStats((prev) =>
                prev
                  ? {
                      ...prev,
                      processed: prev.processed + 1,
                      updated: success ? prev.updated + 1 : prev.updated,
                      failed: success ? prev.failed : prev.failed + 1,
                    }
                  : prev
              );
            } catch (err) {
              console.error(`Error prefilling ${entry.id}:`, err);
              setStats((prev) =>
                prev
                  ? {
                      ...prev,
                      processed: prev.processed + 1,
                      failed: prev.failed + 1,
                    }
                  : prev
              );
            }
          })
        );

        // Delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < entries.length && !abortRef.current) {
          await delay(BATCH_DELAY_MS);
        }
      }

      setCurrentEntry(null);
      toast({
        title: "Prefill Complete",
        description: `Updated ${stats?.updated || 0} entries.`,
      });
    } catch (error: any) {
      console.error("Prefill error:", error);
      toast({
        title: "Prefill Failed",
        description: error.message || "An error occurred during prefill.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    toast({
      title: "Stopping...",
      description: "Prefill will stop after current batch completes.",
    });
  };

  const progressPercent = stats ? Math.round((stats.processed / stats.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Prefill All Metadata</CardTitle>
        </div>
        <CardDescription>
          Fetch complete TMDB data for all entries. Skips posts marked as "Admin Edited".
          For series, fetches all seasons and episode details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Button */}
        <div className="flex gap-2">
          <Button onClick={runPrefill} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isRunning ? "Running..." : "Prefill All Posts"}
          </Button>
          {isRunning && (
            <Button variant="outline" onClick={handleStop}>
              Stop
            </Button>
          )}
        </div>

        {/* Progress */}
        {stats && (
          <div className="space-y-3">
            <Progress value={progressPercent} className="h-2" />

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <span className="text-muted-foreground">Total:</span> {stats.total}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <span className="text-muted-foreground">Processed:</span> {stats.processed}
              </Badge>
              <Badge className="gap-1 bg-green-500/20 text-green-600 border-green-500/30">
                <CheckCircle2 className="w-3 h-3" />
                {stats.updated}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <SkipForward className="w-3 h-3" />
                {stats.skipped}
              </Badge>
              <Badge className="gap-1 bg-red-500/20 text-red-600 border-red-500/30">
                <XCircle className="w-3 h-3" />
                {stats.failed}
              </Badge>
            </div>

            {currentEntry && (
              <p className="text-xs text-muted-foreground">
                Processing: <span className="font-mono">{currentEntry}</span>
              </p>
            )}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>• Processes {BATCH_SIZE} entries at a time with delays to avoid rate limits</p>
          <p>• Entries with "Admin Edited" flag are skipped</p>
          <p>• For series: fetches all seasons and episodes with thumbnails</p>
          <p>• Episode-level edits are preserved (per-episode admin_edited flag)</p>
        </div>
      </CardContent>
    </Card>
  );
}
