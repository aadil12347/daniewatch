import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getMovieDetails, getTVDetails } from "@/lib/tmdb";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export function MetadataBackfillTool() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [stats, setStats] = useState({ updated: 0, failed: 0, skipped: 0 });

  const runBackfill = async () => {
    setIsRunning(true);
    setStats({ updated: 0, failed: 0, skipped: 0 });
    
    try {
      // Fetch all entries that are missing language/country metadata
      const { data: entries, error } = await supabase
        .from("entries")
        .select("id, type, original_language, origin_country")
        .or("original_language.is.null,origin_country.is.null");

      if (error) throw error;

      if (!entries || entries.length === 0) {
        toast({
          title: "No entries to update",
          description: "All entries already have language/country metadata.",
        });
        setIsRunning(false);
        return;
      }

      setProgress({ current: 0, total: entries.length, percentage: 0 });

      const BATCH_SIZE = 5; // Process 5 entries at a time to respect rate limits
      let updated = 0;
      let failed = 0;

      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (entry) => {
            try {
              const id = Number(entry.id);
              let details: any;

              if (entry.type === "movie") {
                details = await getMovieDetails(id);
              } else {
                details = await getTVDetails(id);
              }

              // Update entry with language and country
              const { error: updateError } = await supabase
                .from("entries")
                .update({
                  original_language: details.original_language || null,
                  origin_country: entry.type === "movie" 
                    ? details.production_countries?.map((c: any) => c.iso_3166_1) || null
                    : details.origin_country || null,
                })
                .eq("id", entry.id);

              if (updateError) {
                console.error(`Failed to update entry ${entry.id}:`, updateError);
                failed++;
              } else {
                updated++;
              }
            } catch (error) {
              console.error(`Error processing entry ${entry.id}:`, error);
              failed++;
            }
          })
        );

        const newCurrent = Math.min(i + BATCH_SIZE, entries.length);
        setProgress({
          current: newCurrent,
          total: entries.length,
          percentage: Math.round((newCurrent / entries.length) * 100),
        });
        setStats({ updated, failed, skipped: 0 });

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < entries.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: "Backfill complete",
        description: `Updated ${updated} entries. Failed: ${failed}`,
      });
    } catch (error: any) {
      console.error("Backfill error:", error);
      toast({
        title: "Backfill failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Update Language & Country Metadata
        </CardTitle>
        <CardDescription>
          Backfill existing entries with original_language and origin_country from TMDB.
          This only needs to be run once after adding the new database columns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRunning && (
          <div className="space-y-2">
            <Progress value={progress.percentage} />
            <div className="text-sm text-muted-foreground">
              Processing {progress.current} of {progress.total} entries ({progress.percentage}%)
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                Updated: {stats.updated}
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-destructive" />
                Failed: {stats.failed}
              </span>
            </div>
          </div>
        )}

        <Button
          onClick={runBackfill}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Running Backfill...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Run Metadata Backfill
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
