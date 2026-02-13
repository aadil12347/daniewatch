import { useState } from "react";
import { ExternalLink, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getMovieExternalIds, getTVExternalIds } from "@/lib/tmdb";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SyncImdbIdsBtnProps {
    onProgress?: (val: number | null) => void;
    onSyncingStateChange?: (state: boolean) => void;
}

export function SyncImdbIdsBtn({ onProgress, onSyncingStateChange }: SyncImdbIdsBtnProps) {
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [justCompleted, setJustCompleted] = useState(false);
    const [syncStats, setSyncStats] = useState<{ total: number; updated: number; failed: number } | null>(null);

    const handleSyncImdbIds = async () => {
        setIsSyncing(true);
        onSyncingStateChange?.(true);
        setSyncStats(null);
        onProgress?.(0);

        try {
            // 1. Fetch all entries that are missing imdb_id
            const BATCH_SIZE = 1000;
            const allEntries: any[] = [];
            let from = 0;
            let hasMore = true;

            // Get total count first
            const { count: totalCount, error: countError } = await supabase
                .from("entries")
                .select("*", { count: 'exact', head: true });

            if (countError) throw countError;
            const total = totalCount || 0;

            while (hasMore) {
                const percent = total > 0 ? Math.round((from / total) * 50) : 0;
                onProgress?.(percent);

                const { data, error: fetchError } = await supabase
                    .from("entries")
                    .select("id, type")
                    .is("imdb_id", null)
                    .range(from, from + BATCH_SIZE - 1);

                if (fetchError) throw fetchError;

                if (data && data.length > 0) {
                    allEntries.push(...data);
                }

                hasMore = data?.length === BATCH_SIZE;
                from += BATCH_SIZE;
            }

            if (allEntries.length === 0) {
                toast({
                    title: "No entries to sync",
                    description: "All entries already have IMDb IDs.",
                });
                setIsSyncing(false);
                onSyncingStateChange?.(false);
                setJustCompleted(true);
                setTimeout(() => setJustCompleted(false), 2500);
                onProgress?.(null);
                return;
            }

            // 2. Process each entry with 250ms delay between API calls
            let updated = 0;
            let failed = 0;
            const totalToProcess = allEntries.length;

            for (let i = 0; i < allEntries.length; i++) {
                const entry = allEntries[i];
                const progress = 50 + Math.round((i / totalToProcess) * 50);
                onProgress?.(progress);

                try {
                    // Determine media type and fetch external IDs
                    const mediaType = entry.type === "series" ? "tv" : "movie";
                    const externalIds = mediaType === "tv"
                        ? await getTVExternalIds(Number(entry.id))
                        : await getMovieExternalIds(Number(entry.id));

                    if (externalIds.imdb_id) {
                        // Update the entry with the IMDb ID
                        const { error: updateError } = await supabase
                            .from("entries")
                            .update({ imdb_id: externalIds.imdb_id })
                            .eq("id", entry.id);

                        if (updateError) {
                            console.error(`Failed to update entry ${entry.id}:`, updateError);
                            failed++;
                        } else {
                            updated++;
                        }
                    } else {
                        // No IMDb ID found, skip
                        failed++;
                    }

                    // 250ms delay to respect TMDB rate limits
                    await new Promise(resolve => setTimeout(resolve, 250));
                } catch (error) {
                    console.error(`Failed to fetch external IDs for entry ${entry.id}:`, error);
                    failed++;
                }
            }

            setSyncStats({ total: totalToProcess, updated, failed });
            setJustCompleted(true);
            setTimeout(() => setJustCompleted(false), 2500);

            toast({
                title: "IMDb IDs Synced",
                description: `Updated ${updated} of ${totalToProcess} entries. ${failed} could not be updated.`,
            });
        } catch (error) {
            console.error("[SyncImdbIdsBtn] Error:", error);
            toast({
                title: "Sync Failed",
                description: error instanceof Error ? error.message : "Failed to sync IMDb IDs",
                variant: "destructive",
            });
        } finally {
            setIsSyncing(false);
            onSyncingStateChange?.(false);
            onProgress?.(null);
        }
    };

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={handleSyncImdbIds}
                        disabled={isSyncing}
                        size="sm"
                        className={cn(
                            "relative overflow-hidden h-9 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider transition-all duration-300 gap-2",
                            "border border-transparent",
                            isSyncing
                                ? "bg-white/10 text-white/70 border-white/10 cursor-wait"
                                : justCompleted
                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50 shadow-lg shadow-emerald-500/20"
                                    : "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        {/* Animated background shimmer when syncing */}
                        {isSyncing && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                        )}

                        <div className="relative flex items-center gap-2">
                            {isSyncing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : justCompleted ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                                <ExternalLink className="w-3.5 h-3.5" />
                            )}
                            <span>
                                {isSyncing
                                    ? "Syncing..."
                                    : justCompleted
                                        ? "Done"
                                        : "Sync IMDb IDs"
                                }
                            </span>
                        </div>
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                    <p>Fetch IMDb IDs from TMDB for all entries missing one (uses external_ids API)</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
