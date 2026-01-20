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

const QUERY_PAGE_SIZE = 500;
const BATCH_SIZE = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ArtworkBackfillTool() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [failed, setFailed] = useState(0);
  const [attemptedNoLogo, setAttemptedNoLogo] = useState(0);

  const status = useMemo(() => {
    if (!isRunning) return null;
    return { processed, updated, failed, attemptedNoLogo };
  }, [isRunning, processed, updated, failed, attemptedNoLogo]);

  const pickLogoUrl = (logos: { file_path: string; iso_639_1: string | null }[]) => {
    if (!logos?.length) return null;
    const preferred = logos.find((l) => l.iso_639_1 === "en") ?? logos.find((l) => l.iso_639_1 == null) ?? logos[0];
    return getImageUrl(preferred?.file_path ?? null, "w500");
  };

  const withRetry = async <T,>(fn: () => Promise<T>, tries = 3): Promise<T> => {
    let lastErr: unknown;
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        // TMDB rate limiting is common when doing large backfills.
        if (msg.includes("429") && i < tries - 1) {
          await sleep(900 * (i + 1));
          continue;
        }
        throw e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Unknown error");
  };

  const handleRun = async () => {
    setIsRunning(true);
    setProcessed(0);
    setUpdated(0);
    setFailed(0);
    setAttemptedNoLogo(0);

    try {
      const media_updated_at = new Date().toISOString();
      let processedCount = 0;
      let updatedCount = 0;
      let failedCount = 0;
      let attemptedNoLogoCount = 0;

      // IMPORTANT: paginate; .limit(2000) can silently leave entries unprocessed.
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from("entries")
          .select("id, type, poster_url, backdrop_url, logo_url, vote_average, vote_count")
          .or("poster_url.is.null,logo_url.is.null,vote_average.is.null")
          .order("id", { ascending: true })
          .range(offset, offset + QUERY_PAGE_SIZE - 1);

        if (error) throw error;
        const rows = (data ?? []) as EntryRow[];

        if (rows.length === 0) break;
        offset += rows.length;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);

          // Run a small concurrent batch to avoid TMDB 429s.
          const updates = await Promise.all(
            batch.map(async (row) => {
              const needsPoster = !row.poster_url;
              const needsLogo = !row.logo_url;
              const needsRating = row.vote_average == null;

              if (!needsPoster && !needsLogo && !needsRating) {
                return { id: row.id, patch: null as Record<string, any> | null, noLogo: false };
              }

              const tmdbId = Number(row.id);
              const isSeries = row.type === "series";

              try {
                if (!Number.isFinite(tmdbId)) {
                  return { id: row.id, patch: null as Record<string, any> | null, noLogo: false };
                }

                const patch: Record<string, any> = {};
                let noLogo = false;

                if (!isSeries) {
                  const [details, images] = await withRetry(() =>
                    Promise.all([getMovieDetails(tmdbId), getMovieImages(tmdbId)]) as Promise<any>
                  );

                  if (needsPoster) patch.poster_url = getImageUrl(details.poster_path, "w342");
                  if (!row.backdrop_url) patch.backdrop_url = getImageUrl(details.backdrop_path, "original");

                  if (needsLogo) {
                    const logoUrl = pickLogoUrl(images.logos);
                    if (logoUrl) patch.logo_url = logoUrl;
                    else noLogo = true;
                  }

                  if (needsRating) patch.vote_average = typeof details.vote_average === "number" ? details.vote_average : null;
                  if (row.vote_count == null)
                    patch.vote_count = typeof (details as any).vote_count === "number" ? (details as any).vote_count : null;
                } else {
                  const [details, images] = await withRetry(() =>
                    Promise.all([getTVDetails(tmdbId), getTVImages(tmdbId)]) as Promise<any>
                  );

                  if (needsPoster) patch.poster_url = getImageUrl(details.poster_path, "w342");
                  if (!row.backdrop_url) patch.backdrop_url = getImageUrl(details.backdrop_path, "original");

                  if (needsLogo) {
                    const logoUrl = pickLogoUrl(images.logos);
                    if (logoUrl) patch.logo_url = logoUrl;
                    else noLogo = true;
                  }

                  if (needsRating) patch.vote_average = typeof details.vote_average === "number" ? details.vote_average : null;
                  if (row.vote_count == null)
                    patch.vote_count = typeof (details as any).vote_count === "number" ? (details as any).vote_count : null;
                }

                // Always stamp media_updated_at if we wrote anything, even if logo was missing.
                if (Object.keys(patch).length > 0) patch.media_updated_at = media_updated_at;

                return { id: row.id, patch: Object.keys(patch).length ? patch : null, noLogo };
              } catch {
                return { id: row.id, patch: null as Record<string, any> | null, noLogo: false };
              }
            })
          );

          for (const u of updates) {
            processedCount += 1;
            setProcessed(processedCount);

            if (u.noLogo) {
              attemptedNoLogoCount += 1;
              setAttemptedNoLogo(attemptedNoLogoCount);
            }

            if (!u.patch) continue;

            const { error: updateError } = await supabase.from("entries").update(u.patch).eq("id", u.id);
            if (!updateError) {
              updatedCount += 1;
              setUpdated(updatedCount);
            } else {
              failedCount += 1;
              setFailed(failedCount);
            }

            // tiny pacing to keep TMDB + Supabase happy during big runs
            await sleep(80);
          }
        }

        // brief pause between pages
        await sleep(300);
      }

      toast({
        title: "Backfill complete",
        description: `Processed ${processedCount} entries. Updated ${updatedCount}. Failed ${failedCount}. (Some titles may have no logo on TMDB.)`,
      });

      if (processedCount === 0) {
        toast({ title: "Nothing to backfill", description: "All entries already have artwork + rating fields." });
      }
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
            <Badge variant="outline">Failed: {status.failed}</Badge>
            <Badge variant="outline">No logo on TMDB: {status.attemptedNoLogo}</Badge>
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
