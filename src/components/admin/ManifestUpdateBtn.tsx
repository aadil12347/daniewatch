import { useState, useEffect } from "react";
import { RefreshCw, Clock, Database, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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
    imdb_id: string | null;
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
    const [justCompleted, setJustCompleted] = useState(false);

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

    // Flash success state briefly after completion
    useEffect(() => {
        if (justCompleted) {
            const timer = setTimeout(() => setJustCompleted(false), 2500);
            return () => clearTimeout(timer);
        }
    }, [justCompleted]);

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
                const percent = total > 0 ? Math.round((from / total) * 100) : 0;

                setFetchProgress(`Fetching ${percent}%`);
                onProgress?.(percent);

                const { data, error: fetchError } = await supabase
                    .from("entries")
                    .select(
                        "id, type, title, hover_image_url, genre_ids, release_year, original_language, origin_country, content, poster_url, backdrop_url, logo_url, vote_average, vote_count, imdb_id"
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
                    imdb_id: (entry as any).imdb_id || null,
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
            setJustCompleted(true);

            toast({
                title: "Sync Complete",
                description: `${items.length} entries synced to manifest.`,
            });
        } catch (error) {
            console.error("[ManifestUpdateBtn] Error:", error);
            toast({
                title: "Sync Failed",
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

    // Determine if the last update is stale (> 24 hours)
    const isStale = lastUpdated
        ? (Date.now() - new Date(lastUpdated).getTime()) > 24 * 60 * 60 * 1000
        : true;

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-3">
                {/* Last sync timestamp */}
                {lastUpdated && !isGenerating && !justCompleted && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className={cn(
                                "hidden sm:flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-tight px-2.5 py-1 rounded-full border transition-all duration-300 cursor-default select-none",
                                isStale
                                    ? "text-amber-400/80 border-amber-500/20 bg-amber-500/5"
                                    : "text-emerald-400/70 border-emerald-500/15 bg-emerald-500/5"
                            )}>
                                {isStale ? (
                                    <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                                ) : (
                                    <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />
                                )}
                                <span className="whitespace-nowrap">
                                    {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                            <p>Last database sync: {new Date(lastUpdated).toLocaleString()}</p>
                            {isStale && <p className="text-amber-400 mt-1">Consider syncing — data may be outdated</p>}
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Success flash */}
                {justCompleted && !isGenerating && (
                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 animate-in fade-in slide-in-from-right-2 duration-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Synced</span>
                    </div>
                )}

                {/* Main sync button */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={handleGenerateManifest}
                            disabled={isGenerating}
                            size="sm"
                            className={cn(
                                "relative overflow-hidden h-9 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider transition-all duration-300 gap-2",
                                "border border-transparent",
                                isGenerating
                                    ? "bg-white/10 text-white/70 border-white/10 cursor-wait"
                                    : justCompleted
                                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50 shadow-lg shadow-emerald-500/20"
                                        : "bg-cinema-red hover:bg-cinema-red/85 active:bg-cinema-red/70 text-white shadow-lg shadow-cinema-red/25 hover:shadow-cinema-red/40 hover:scale-[1.02] active:scale-[0.98]"
                            )}
                        >
                            {/* Animated background shimmer when generating */}
                            {isGenerating && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                            )}

                            <div className="relative flex items-center gap-2">
                                {isGenerating ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : justCompleted ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : (
                                    <Database className="w-3.5 h-3.5" />
                                )}
                                <span>
                                    {isGenerating
                                        ? (fetchProgress || "Syncing...")
                                        : justCompleted
                                            ? "Done"
                                            : "Sync Data"
                                    }
                                </span>
                            </div>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                        <p>Regenerate the manifest file from all database entries for faster page loads</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
}
