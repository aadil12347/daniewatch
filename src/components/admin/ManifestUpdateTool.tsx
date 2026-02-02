import { useState } from "react";
import { RefreshCw, Database, CheckCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ManifestItem {
  id: number;
  media_type: "movie" | "tv";
  title: string | null;
  hover_image_url: string | null;
  genre_ids: number[];
  release_year: number | null;
  original_language: string | null;
  origin_country: string[] | null;
  poster_url: string | null;
  backdrop_url: string | null;
  logo_url: string | null;
  vote_average: number | null;
  vote_count: number | null;
  hasWatch: boolean;
  hasDownload: boolean;
}

interface Manifest {
  version: number;
  generated_at: string;
  items: ManifestItem[];
}

export function ManifestUpdateTool() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);

  // Try to read last manifest metadata on mount
  useState(() => {
    const cached = localStorage.getItem("db_manifest_meta");
    if (cached) {
      try {
        const meta = JSON.parse(cached);
        setLastGenerated(meta.generated_at);
        setItemCount(meta.item_count);
      } catch {
        // ignore
      }
    }
  });

  const handleGenerateManifest = async () => {
    setIsGenerating(true);
    setFetchProgress(null);

    try {
      // 1. Fetch all entries from DB using pagination to bypass 1000 row limit
      const BATCH_SIZE = 1000;
      const allEntries: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        setFetchProgress(`Fetching ${from + BATCH_SIZE}...`);
        
        const { data, error: fetchError } = await supabase
          .from("entries")
          .select(
            "id, type, title, hover_image_url, genre_ids, release_year, original_language, origin_country, content, poster_url, backdrop_url, logo_url, vote_average, vote_count"
          )
          .range(from, from + BATCH_SIZE - 1);

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          allEntries.push(...data);
        }

        hasMore = data?.length === BATCH_SIZE;
        from += BATCH_SIZE;
      }

      setFetchProgress("Processing...");

      if (allEntries.length === 0) {
        toast({
          title: "No entries found",
          description: "The database is empty. Add some entries first.",
          variant: "destructive",
        });
        setIsGenerating(false);
        setFetchProgress(null);
        return;
      }

      const entries = allEntries;

      // 2. Convert to manifest format
      const items: ManifestItem[] = entries.map((entry) => {
        let hasWatch = false;
        let hasDownload = false;

        if (entry.type === "movie") {
          const content = entry.content as { watch_link?: string; download_link?: string };
          hasWatch = !!(content.watch_link && content.watch_link.trim());
          hasDownload = !!(content.download_link && content.download_link.trim());
        } else if (entry.type === "series") {
          const content = entry.content as Record<string, { watch_links?: string[]; download_links?: string[] }>;
          Object.keys(content).forEach((key) => {
            if (!key.startsWith("season_")) return;
            const season = content[key];
            if (season.watch_links?.some((link) => link && link.trim())) hasWatch = true;
            if (season.download_links?.some((link) => link && link.trim())) hasDownload = true;
          });
        }

        const mediaType = entry.type === "series" ? "tv" : "movie";

        return {
          id: Number(entry.id),
          media_type: mediaType as "movie" | "tv",
          title: entry.title || null,
          hover_image_url: entry.hover_image_url || null,
          genre_ids: entry.genre_ids || [],
          release_year: entry.release_year || null,
          original_language: entry.original_language || null,
          origin_country: entry.origin_country || null,
          poster_url: (entry as any).poster_url || null,
          backdrop_url: (entry as any).backdrop_url || null,
          logo_url: (entry as any).logo_url || null,
          vote_average: typeof (entry as any).vote_average === "number" ? (entry as any).vote_average : null,
          vote_count: typeof (entry as any).vote_count === "number" ? (entry as any).vote_count : null,
          hasWatch,
          hasDownload,
        };
      });

      // Sort items: newest first (by release_year desc), then by rating
      items.sort((a, b) => {
        const yearA = a.release_year ?? new Date().getFullYear();
        const yearB = b.release_year ?? new Date().getFullYear();
        if (yearB !== yearA) return yearB - yearA;
        return (b.vote_average ?? 0) - (a.vote_average ?? 0);
      });

      // 3. Build manifest object
      const manifest: Manifest = {
        version: 1,
        generated_at: new Date().toISOString(),
        items,
      };

      const manifestJson = JSON.stringify(manifest, null, 2);
      const manifestBlob = new Blob([manifestJson], { type: "application/json" });

      // 4. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("manifests")
        .upload("db_manifest_v1.json", manifestBlob, {
          cacheControl: "60",
          upsert: true,
          contentType: "application/json",
        });

      if (uploadError) throw uploadError;

      // 5. Update local state and cache
      const generatedAt = manifest.generated_at;
      setLastGenerated(generatedAt);
      setItemCount(items.length);

      localStorage.setItem(
        "db_manifest_meta",
        JSON.stringify({
          generated_at: generatedAt,
          item_count: items.length,
        })
      );

      // Clear both caches so manifest will be re-fetched
      localStorage.removeItem("db_manifest_cache");
      sessionStorage.removeItem("manifest_session_checked");

      // Invalidate availability cache so admin dots update immediately
      queryClient.invalidateQueries({ queryKey: ["entry-availability"] });

      toast({
        title: "Manifest updated successfully",
        description: `${items.length} entries exported to manifest file.`,
      });
    } catch (error) {
      console.error("[ManifestUpdateTool] Error:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to generate manifest",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setFetchProgress(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Update Data
            </CardTitle>
            <CardDescription className="mt-1">
              Generate a manifest file containing all database entries for faster page loading
            </CardDescription>
          </div>
          <Button onClick={handleGenerateManifest} disabled={isGenerating} size="sm">
            {isGenerating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isGenerating ? (fetchProgress || "Generating...") : "Update Data"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {lastGenerated ? (
            <>
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Last updated: {formatDistanceToNow(new Date(lastGenerated), { addSuffix: true })}
              </Badge>
              {itemCount !== null && (
                <Badge variant="secondary" className="gap-1">
                  <Database className="w-3 h-3" />
                  {itemCount} entries
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              Never generated
            </Badge>
          )}
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>• This tool exports all database entries into a single JSON file stored in Supabase Storage</p>
          <p>• The website will cache this file locally to display DB items first without querying the database</p>
          <p>• Click "Update Data" after adding/editing entries to refresh the manifest</p>
          <p>• Playback links remain real-time (fetched per item when user clicks play)</p>
        </div>
      </CardContent>
    </Card>
  );
}
