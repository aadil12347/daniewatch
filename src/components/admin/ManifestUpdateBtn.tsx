
import { useState, useEffect } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

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
    app_version: string;
    generated_at: string;
    items: ManifestItem[];
}

interface ManifestUpdateBtnProps {
    onProgress?: (val: number | null) => void;
    onGeneratingStateChange?: (state: boolean) => void;
}

export function ManifestUpdateBtn({ onProgress, onGeneratingStateChange }: ManifestUpdateBtnProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isGenerating, setIsGenerating] = useState(false);
    const [fetchProgress, setFetchProgress] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Load last updated time on mount and after generation
    const loadLastUpdated = () => {
        const meta = localStorage.getItem("db_manifest_meta");
        if (meta) {
            try {
                const parsed = JSON.parse(meta);
                setLastUpdated(parsed.generated_at);
            } catch (e) {
                console.error("Error parsing manifest meta:", e);
            }
        }
    };

    useEffect(() => {
        loadLastUpdated();
    }, []);

    const handleGenerateManifest = async () => {
        setIsGenerating(true);
        onGeneratingStateChange?.(true);
        setFetchProgress(null);
        onProgress?.(0);

        try {
            // 1. Get total count first for progress calculation
            const { count: totalCount, error: countError } = await supabase
                .from("entries")
                .select("*", { count: 'exact', head: true });

            if (countError) throw countError;
            const total = totalCount || 0;

            // 2. Fetch all entries from DB using pagination
            const BATCH_SIZE = 1000;
            const allEntries: any[] = [];
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const currentBatch = Math.min(from + BATCH_SIZE, total);
                const percent = total > 0 ? Math.round((from / total) * 100) : 0;

                setFetchProgress(`Fetching ${percent}%...`);
                onProgress?.(percent);

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
            onProgress?.(95);

            if (allEntries.length === 0) {
                toast({
                    title: "No entries found",
                    description: "The database is empty. Add some entries first.",
                    variant: "destructive",
                });
                setIsGenerating(false);
                onGeneratingStateChange?.(false);
                setFetchProgress(null);
                onProgress?.(null);
                return;
            }

            const entries = allEntries;

            // 3. Convert to manifest format
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

            // Sort items: newest first
            items.sort((a, b) => {
                const yearA = a.release_year ?? new Date().getFullYear();
                const yearB = b.release_year ?? new Date().getFullYear();
                if (yearB !== yearA) return yearB - yearA;
                return (b.vote_average ?? 0) - (a.vote_average ?? 0);
            });

            // 4. Build manifest object
            const appVersion = `v${Date.now()}`;
            const manifest: Manifest = {
                version: 1,
                app_version: appVersion,
                generated_at: new Date().toISOString(),
                items,
            };

            const manifestJson = JSON.stringify(manifest, null, 2);
            const manifestBlob = new Blob([manifestJson], { type: "application/json" });

            // 5. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from("manifests")
                .upload("db_manifest_v1.json", manifestBlob, {
                    cacheControl: "60",
                    upsert: true,
                    contentType: "application/json",
                });

            if (uploadError) throw uploadError;

            onProgress?.(100);

            // 6. Update local state and cache
            localStorage.setItem(
                "db_manifest_meta",
                JSON.stringify({
                    app_version: appVersion,
                    generated_at: manifest.generated_at,
                    item_count: items.length,
                })
            );

            // Clear all caches
            localStorage.removeItem("db_manifest_cache");
            sessionStorage.removeItem("admin_db_manifest_cache");
            sessionStorage.removeItem("manifest_session_checked");
            sessionStorage.removeItem("db_manifest_cache");

            // Trigger background refetch
            window.dispatchEvent(new CustomEvent("manifest:background-refresh"));
            queryClient.invalidateQueries({ queryKey: ["entry-availability"] });

            loadLastUpdated();

            toast({
                title: "Update Successful",
                description: `${items.length} entries updated in manifest.`,
            });
        } catch (error) {
            console.error("[ManifestUpdateBtn] Error:", error);
            toast({
                title: "Update failed",
                description: error instanceof Error ? error.message : "Failed to update data",
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
            onGeneratingStateChange?.(false);
            setFetchProgress(null);
            onProgress?.(null);
        }
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-3">
                {lastUpdated && !isGenerating && (
                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 font-mono uppercase tracking-tighter">
                        <Clock className="w-2.5 h-2.5" />
                        Last Sync: {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                    </span>
                )}
                <Button
                    onClick={handleGenerateManifest}
                    disabled={isGenerating}
                    size="sm"
                    variant="outline"
                    className="bg-cinema-red hover:bg-cinema-red/90 text-white border-cinema-red hover:border-cinema-red shadow-lg shadow-cinema-red/20 transition-all duration-300 gap-2 h-9 px-4 rounded-full"
                >
                    {isGenerating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="font-bold uppercase tracking-wider text-xs">
                        {isGenerating ? (fetchProgress || "Updating...") : "Update"}
                    </span>
                </Button>
            </div>
        </div>
    );
}
