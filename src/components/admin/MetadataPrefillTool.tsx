import { useState, useRef, useMemo, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Database,
  Search,
  Download,
  Pause,
  Play,
  Square,
  Filter,
  Image,
  ImageOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface EntryWithMeta {
  id: string;
  type: "movie" | "series";
  title: string | null;
  admin_edited: boolean | null;
  poster_url: string | null;
  backdrop_url: string | null;
  logo_url: string | null;
  release_year: number | null;
  vote_average: number | null;
}

interface UpdateLogEntry {
  id: string;
  title: string;
  type: "movie" | "series";
  success: boolean;
  message: string;
  timestamp: Date;
}

interface PrefillStats {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  startTime: number;
}

const FETCH_BATCH_SIZE = 1000;
const PROCESS_BATCH_SIZE = 5;
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

// Generate year options from current year to 1900
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = currentYear + 1; year >= 1900; year--) {
    years.push(year.toString());
  }
  return years;
};

export function MetadataPrefillTool() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<PrefillStats | null>(null);
  const [currentEntry, setCurrentEntry] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);

  // All entries from database
  const [allEntries, setAllEntries] = useState<EntryWithMeta[]>([]);
  const [updateLog, setUpdateLog] = useState<UpdateLogEntry[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [filterMissing, setFilterMissing] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"year" | "name" | "id" | "rating" | "missing">("year");

  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const yearOptions = useMemo(() => generateYearOptions(), []);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let result = allEntries.filter((e) => !e.admin_edited);

    // Search by name or ID
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) => e.id.toString().includes(q) || e.title?.toLowerCase().includes(q)
      );
    }

    // Filter by year
    if (selectedYear !== "all") {
      if (selectedYear === "null") {
        result = result.filter((e) => !e.release_year);
      } else {
        result = result.filter((e) => e.release_year === Number(selectedYear));
      }
    }

    // Filter by missing data
    if (filterMissing.includes("poster")) {
      result = result.filter((e) => !e.poster_url);
    }
    if (filterMissing.includes("backdrop")) {
      result = result.filter((e) => !e.backdrop_url);
    }
    if (filterMissing.includes("logo")) {
      result = result.filter((e) => !e.logo_url);
    }

    // Sort
    return result.sort((a, b) => {
      switch (sortBy) {
        case "year":
          return (b.release_year ?? 0) - (a.release_year ?? 0);
        case "name":
          return (a.title ?? "").localeCompare(b.title ?? "");
        case "id":
          return a.id.localeCompare(b.id);
        case "rating":
          return (b.vote_average ?? 0) - (a.vote_average ?? 0);
        case "missing":
          const missingA = [!a.poster_url, !a.backdrop_url, !a.logo_url].filter(Boolean).length;
          const missingB = [!b.poster_url, !b.backdrop_url, !b.logo_url].filter(Boolean).length;
          return missingB - missingA;
        default:
          return 0;
      }
    });
  }, [allEntries, searchQuery, selectedYear, filterMissing, sortBy]);

  const adminEditedCount = useMemo(
    () => allEntries.filter((e) => e.admin_edited).length,
    [allEntries]
  );

  // Fetch all entries with pagination
  const fetchAllEntries = async () => {
    setIsLoading(true);
    setFetchProgress("Starting fetch...");

    try {
      const allFetched: EntryWithMeta[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        setFetchProgress(`Fetching entries ${from + 1} - ${from + FETCH_BATCH_SIZE}...`);

        const { data, error } = await supabase
          .from("entries")
          .select(
            "id, type, title, admin_edited, poster_url, backdrop_url, logo_url, release_year, vote_average"
          )
          .range(from, from + FETCH_BATCH_SIZE - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allFetched.push(
            ...data.map((d) => ({
              ...d,
              type: d.type as "movie" | "series",
            }))
          );
        }

        hasMore = data?.length === FETCH_BATCH_SIZE;
        from += FETCH_BATCH_SIZE;
      }

      setAllEntries(allFetched);
      setFetchProgress(null);
      toast({
        title: "Entries Loaded",
        description: `Loaded ${allFetched.length} entries from database.`,
      });
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast({
        title: "Fetch Failed",
        description: error.message || "Failed to load entries.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setFetchProgress(null);
    }
  };

  const fetchWithRetry = async <T,>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T | null> => {
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

  const prefillMovieEntry = async (entryId: string): Promise<{ success: boolean; message: string }> => {
    const [details, images] = await Promise.all([
      fetchWithRetry(() => getMovieDetails(Number(entryId))),
      fetchWithRetry(() => getMovieImages(Number(entryId))),
    ]);

    if (!details) return { success: false, message: "TMDB not found" };

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
        release_year: details.release_date ? Number(details.release_date.split("-")[0]) : null,
        original_language: details.original_language || null,
        origin_country: details.production_countries?.map((c) => c.iso_3166_1) || null,
        media_updated_at: new Date().toISOString(),
      })
      .eq("id", entryId);

    if (error) return { success: false, message: error.message };
    return { success: true, message: "Updated poster, backdrop, logo" };
  };

  const prefillSeriesEntry = async (entryId: string): Promise<{ success: boolean; message: string }> => {
    const [details, images] = await Promise.all([
      fetchWithRetry(() => getTVDetails(Number(entryId))),
      fetchWithRetry(() => getTVImages(Number(entryId))),
    ]);

    if (!details) return { success: false, message: "TMDB not found" };

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
        release_year: details.first_air_date ? Number(details.first_air_date.split("-")[0]) : null,
        original_language: details.original_language || null,
        origin_country: details.origin_country || null,
        media_updated_at: new Date().toISOString(),
      })
      .eq("id", entryId);

    if (entryError) return { success: false, message: entryError.message };

    // Fetch and save episode metadata for all seasons
    const validSeasons = details.seasons?.filter((s) => s.season_number > 0) || [];
    let totalEpisodes = 0;

    for (const season of validSeasons) {
      if (abortRef.current || pauseRef.current) break;

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
          (existingEpisodes || []).filter((e) => e.admin_edited).map((e) => e.episode_number)
        );

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

        totalEpisodes += records.length;
        await delay(300);
      } catch (err) {
        console.error(`Error fetching season ${season.season_number}:`, err);
      }
    }

    return {
      success: true,
      message: `Updated ${validSeasons.length} seasons (${totalEpisodes} episodes)`,
    };
  };

  const addLogEntry = useCallback((entry: UpdateLogEntry) => {
    setUpdateLog((prev) => [entry, ...prev].slice(0, 500)); // Keep last 500 entries
  }, []);

  const runPrefill = async (entriesToProcess: EntryWithMeta[]) => {
    if (entriesToProcess.length === 0) {
      toast({ title: "No entries to process", description: "Apply different filters." });
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    pauseRef.current = false;

    const initialStats: PrefillStats = {
      total: entriesToProcess.length,
      processed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      startTime: Date.now(),
    };
    setStats(initialStats);

    try {
      for (let i = 0; i < entriesToProcess.length; i += PROCESS_BATCH_SIZE) {
        if (abortRef.current) break;

        // Wait while paused
        while (pauseRef.current && !abortRef.current) {
          await delay(500);
        }
        if (abortRef.current) break;

        const batch = entriesToProcess.slice(i, i + PROCESS_BATCH_SIZE);

        await Promise.all(
          batch.map(async (entry) => {
            if (abortRef.current) return;

            setCurrentEntry(`${entry.title || entry.id} (${entry.id})`);

            try {
              let result: { success: boolean; message: string };
              if (entry.type === "movie") {
                result = await prefillMovieEntry(entry.id);
              } else {
                result = await prefillSeriesEntry(entry.id);
              }

              addLogEntry({
                id: entry.id,
                title: entry.title || entry.id,
                type: entry.type,
                success: result.success,
                message: result.message,
                timestamp: new Date(),
              });

              setStats((prev) =>
                prev
                  ? {
                      ...prev,
                      processed: prev.processed + 1,
                      updated: result.success ? prev.updated + 1 : prev.updated,
                      failed: result.success ? prev.failed : prev.failed + 1,
                    }
                  : prev
              );
            } catch (err: any) {
              console.error(`Error prefilling ${entry.id}:`, err);
              addLogEntry({
                id: entry.id,
                title: entry.title || entry.id,
                type: entry.type,
                success: false,
                message: err.message || "Unknown error",
                timestamp: new Date(),
              });

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

        if (i + PROCESS_BATCH_SIZE < entriesToProcess.length && !abortRef.current) {
          await delay(BATCH_DELAY_MS);
        }
      }

      setCurrentEntry(null);
      toast({
        title: abortRef.current ? "Prefill Stopped" : "Prefill Complete",
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
      setIsPaused(false);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
    toast({ title: "Stopping...", description: "Will stop after current batch." });
  };

  const handlePauseResume = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
  };

  const exportLog = () => {
    const csv = [
      "ID,Title,Type,Success,Message,Timestamp",
      ...updateLog.map(
        (e) =>
          `"${e.id}","${e.title}","${e.type}","${e.success}","${e.message}","${e.timestamp.toISOString()}"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prefill-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleMissingFilter = (filter: string) => {
    setFilterMissing((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  };

  const progressPercent = stats ? Math.round((stats.processed / stats.total) * 100) : 0;
  const rate =
    stats && stats.processed > 0
      ? ((stats.processed / (Date.now() - stats.startTime)) * 1000).toFixed(1)
      : "0";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Prefill All Metadata</CardTitle>
        </div>
        <CardDescription>
          Fetch complete TMDB data for all entries. Filter, sort, and track progress in real-time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Load Entries Button */}
        {allEntries.length === 0 && (
          <Button onClick={fetchAllEntries} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {fetchProgress || "Loading..."}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Load All Entries
              </>
            )}
          </Button>
        )}

        {/* Filters Section */}
        {allEntries.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Year Filter */}
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="null">No Year</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">Year (Newest)</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="id">ID</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="missing">Missing Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Missing Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="missing-poster"
                  checked={filterMissing.includes("poster")}
                  onCheckedChange={() => toggleMissingFilter("poster")}
                />
                <label htmlFor="missing-poster" className="text-sm cursor-pointer">
                  Missing Poster
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="missing-backdrop"
                  checked={filterMissing.includes("backdrop")}
                  onCheckedChange={() => toggleMissingFilter("backdrop")}
                />
                <label htmlFor="missing-backdrop" className="text-sm cursor-pointer">
                  Missing Backdrop
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="missing-logo"
                  checked={filterMissing.includes("logo")}
                  onCheckedChange={() => toggleMissingFilter("logo")}
                />
                <label htmlFor="missing-logo" className="text-sm cursor-pointer">
                  Missing Logo
                </label>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-muted/50 rounded-lg">
              <div className="flex flex-wrap gap-3 text-sm">
                <span>
                  Total: <strong>{allEntries.length}</strong>
                </span>
                <span>
                  Filtered: <strong>{filteredEntries.length}</strong>
                </span>
                <span className="text-muted-foreground">
                  Admin Edited: <strong>{adminEditedCount}</strong> (skipped)
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAllEntries} disabled={isRunning}>
                <RefreshCw className="w-3 h-3 mr-1" />
                Refresh
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => runPrefill(filteredEntries)}
                disabled={isRunning || filteredEntries.length === 0}
              >
                {isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Prefill Filtered ({filteredEntries.length})
              </Button>
              <Button
                variant="secondary"
                onClick={() => runPrefill(allEntries.filter((e) => !e.admin_edited))}
                disabled={isRunning}
              >
                Prefill All ({allEntries.length - adminEditedCount})
              </Button>
              {isRunning && (
                <>
                  <Button variant="outline" onClick={handlePauseResume}>
                    {isPaused ? (
                      <>
                        <Play className="w-4 h-4 mr-1" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </>
                    )}
                  </Button>
                  <Button variant="destructive" onClick={handleStop}>
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        {/* Progress Section */}
        {stats && (
          <div className="space-y-3 pt-2 border-t">
            <Progress value={progressPercent} className="h-2" />

            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {stats.processed} / {stats.total}
                </Badge>
                <Badge className="bg-green-500/20 text-green-600 border-green-500/30 gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {stats.updated}
                </Badge>
                <Badge className="bg-red-500/20 text-red-600 border-red-500/30 gap-1">
                  <XCircle className="w-3 h-3" />
                  {stats.failed}
                </Badge>
              </div>
              <span className="text-muted-foreground">Rate: {rate}/sec</span>
            </div>

            {currentEntry && (
              <p className="text-xs text-muted-foreground">
                Currently: <span className="font-mono">{currentEntry}</span>
                {isPaused && <Badge variant="secondary" className="ml-2">Paused</Badge>}
              </p>
            )}
          </div>
        )}

        {/* Update Log */}
        {updateLog.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Recent Updates</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={exportLog}>
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setUpdateLog([])}>
                  Clear
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-1">
                {updateLog.map((entry, idx) => (
                  <div
                    key={`${entry.id}-${idx}`}
                    className={`text-xs flex items-start gap-2 py-1 ${
                      entry.success ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {entry.success ? (
                      <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    )}
                    <span className="break-all">
                      <strong>{entry.title}</strong> ({entry.id}) - {entry.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Info Footer */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>• Fetches entries in batches of {FETCH_BATCH_SIZE} to handle large databases</p>
          <p>• Processes {PROCESS_BATCH_SIZE} entries at a time with rate-limiting</p>
          <p>• Entries with "Admin Edited" flag are automatically skipped</p>
          <p>• For series: fetches all seasons and episodes with thumbnails</p>
        </div>
      </CardContent>
    </Card>
  );
}
