import { useMemo, useState } from "react";
import { Brush, RefreshCw } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getImageUrl, getMovieDetails, getMovieImages, getTVDetails, getTVImages } from "@/lib/tmdb";

type EntryRow = {
  id: string;
  type: "movie" | "series";
  poster_url: string | null;
  backdrop_url: string | null;
  logo_url: string | null;
  vote_average: number | null;
  vote_count: number | null;
};

const BATCH_SIZE = 15;

export function ArtworkBackfillTool() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);

  const status = useMemo(() => {
    if (!isRunning) return null;
    return { processed, updated };
  }, [isRunning, processed, updated]);

  const pickLogoUrl = (logos: { file_path: string; iso_639_1: string | null }[]) => {
    if (!logos?.length) return null;
    const preferred = logos.find((l) => l.iso_639_1 === "en") ?? logos.find((l) => l.iso_639_1 == null) ?? logos[0];
    return getImageUrl(preferred?.file_path ?? null, "w500");
  };

  const handleRun = async () => {
    setIsRunning(true);
    setProcessed(0);
    setUpdated(0);

    try {
      const { data, error } = await supabase
        .from("entries")
        .select("id, type, poster_url, backdrop_url, logo_url, vote_average, vote_count")
        .or("poster_url.is.null,logo_url.is.null,vote_average.is.null")
        .limit(2000);

      if (error) throw error;
      const rows = (data ?? []) as EntryRow[];

      if (rows.length === 0) {
        toast({ title: "Nothing to backfill", description: "All entries already have artwork + rating fields." });
        return;
      }

      const media_updated_at = new Date().toISOString();
      let processedCount = 0;
      let updatedCount = 0;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);

        const updates = await Promise.all(
          batch.map(async (row) => {
            const needsPoster = !row.poster_url;
            const needsLogo = !row.logo_url;
            const needsRating = row.vote_average == null;

            if (!needsPoster && !needsLogo && !needsRating) {
              return { id: row.id, patch: null as Record<string, any> | null };
            }

            const tmdbId = Number(row.id);
            const isSeries = row.type === "series";

            try {
              if (!Number.isFinite(tmdbId)) return { id: row.id, patch: null };

              if (!isSeries) {
                const [details, images] = await Promise.all([getMovieDetails(tmdbId), getMovieImages(tmdbId)]);

                const patch: Record<string, any> = {};
                if (needsPoster) patch.poster_url = getImageUrl(details.poster_path, "w342");
                if (!row.backdrop_url) patch.backdrop_url = getImageUrl(details.backdrop_path, "original");
                if (needsLogo) patch.logo_url = pickLogoUrl(images.logos);
                if (needsRating) patch.vote_average = typeof details.vote_average === "number" ? details.vote_average : null;
                if (row.vote_count == null) patch.vote_count = typeof (details as any).vote_count === "number" ? (details as any).vote_count : null;

                if (Object.keys(patch).length === 0) return { id: row.id, patch: null };
                patch.media_updated_at = media_updated_at;

                return { id: row.id, patch };
              }

              const [details, images] = await Promise.all([getTVDetails(tmdbId), getTVImages(tmdbId)]);

              const patch: Record<string, any> = {};
              if (needsPoster) patch.poster_url = getImageUrl(details.poster_path, "w342");
              if (!row.backdrop_url) patch.backdrop_url = getImageUrl(details.backdrop_path, "original");
              if (needsLogo) patch.logo_url = pickLogoUrl(images.logos);
              if (needsRating) patch.vote_average = typeof details.vote_average === "number" ? details.vote_average : null;
              if (row.vote_count == null) patch.vote_count = typeof (details as any).vote_count === "number" ? (details as any).vote_count : null;

              if (Object.keys(patch).length === 0) return { id: row.id, patch: null };
              patch.media_updated_at = media_updated_at;

              return { id: row.id, patch };
            } catch {
              return { id: row.id, patch: null };
            }
          })
        );

        for (const u of updates) {
          processedCount += 1;
          setProcessed(processedCount);

          if (!u.patch) continue;

          const { error: updateError } = await supabase.from("entries").update(u.patch).eq("id", u.id);
          if (!updateError) {
            updatedCount += 1;
            setUpdated(updatedCount);
          }
        }
      }

      toast({
        title: "Backfill complete",
        description: `Processed ${rows.length} entries. Updated ${updatedCount} entries.`,
      });
    } catch (e) {
      console.error("[ArtworkBackfillTool]", e);
      toast({
        title: "Backfill failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brush className="w-5 h-5" />
              Artwork Backfill (missing only)
            </CardTitle>
            <CardDescription className="mt-1">
              Fills poster/logo/rating fields for existing entries without overwriting what you already have.
            </CardDescription>
          </div>
          <Button onClick={handleRun} disabled={isRunning} size="sm">
            {isRunning ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {isRunning ? "Running..." : "Run Backfill"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {status ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Processed: {status.processed}</Badge>
            <Badge variant="outline">Updated: {status.updated}</Badge>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Tip: Run this once, then click <strong>Update Data</strong> to regenerate the DB manifest.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
