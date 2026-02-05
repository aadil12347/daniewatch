import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  Loader2,
  Save,
  Trash2,
  Film,
  Tv,
  ArrowLeft,
  Archive,
  RotateCcw,
  Link2,
  ClipboardPaste,
  Wrench,
  RefreshCw,
  Settings2,
  Image as ImageIcon,
  Sparkles,
  FileVideo,
  Download,
  CheckCircle2,
  X,
  ChevronDown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useEntries } from "@/hooks/useEntries";
import { useEntriesTrash, TrashedEntry } from "@/hooks/useEntriesTrash";
import { useEntryMetadata } from "@/hooks/useEntryMetadata";
import { useToast } from "@/hooks/use-toast";
import {
  getMovieDetails,
  getMovieImages,
  getMovieCredits,
  getTVDetails,
  getTVImages,
  getTVCredits,
  getTVSeasonDetails,
  getImageUrl,
} from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LineNumberedTextarea } from "@/components/ui/LineNumberedTextarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ManifestUpdateTool } from "@/components/admin/ManifestUpdateTool";

import { EpisodeMetadataEditor } from "@/components/admin/EpisodeMetadataEditor";
import { PostMetadataEditor } from "@/components/admin/PostMetadataEditor";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const UPDATE_LINKS_CACHE_KEY = "updateLinksPanelState_v1";
const UPDATE_LINKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface TMDBResult {
  id: number;
  title: string;
  posterUrl: string | null;
  year: string;
  type: "movie" | "series";
  genreIds?: number[];
  releaseYear?: number | null;
  seasons?: number;
  seasonDetails?: { season_number: number; episode_count: number }[];
}

export type UpdateLinksPanelProps = {
  /** If provided, the panel will automatically search and load this TMDB id on mount. */
  initialTmdbId?: string;
  /** When embedded (e.g. inside a modal), hides page-only header/back button. */
  embedded?: boolean;
  className?: string;
};

export function UpdateLinksPanel({ initialTmdbId, embedded = false, className }: UpdateLinksPanelProps) {
  const { toast } = useToast();
  const { fetchEntry, saveMovieEntry, saveSeriesSeasonEntry, deleteEntry, deleteSeasonFromEntry } = useEntries();
  const { trashedEntries, moveToTrash, restoreFromTrash, permanentlyDelete, emptyTrash } = useEntriesTrash();
  const { saveEpisodeMetadata, markEntryAdminEdited } = useEntryMetadata();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"update" | "trash" | "tools">("update");

  // Search state
  const [tmdbId, setTmdbId] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Store active result AND candidates for manual switching
  const [tmdbResult, setTmdbResult] = useState<TMDBResult | null>(null);
  const [candidates, setCandidates] = useState<{ movie: TMDBResult | null; series: TMDBResult | null }>({
    movie: null,
    series: null,
  });
  const [searchError, setSearchError] = useState<string | null>(null);

  // Entry state
  const [entryExists, setEntryExists] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);

  // Movie inputs
  const [movieWatchLink, setMovieWatchLink] = useState("");
  const [movieDownloadLink, setMovieDownloadLink] = useState("");

  // Hover character image (optional, per title)
  const [hoverImageUrl, setHoverImageUrl] = useState("");

  // Series inputs
  const [seriesWatchLinks, setSeriesWatchLinks] = useState("");
  const [seriesDownloadLinks, setSeriesDownloadLinks] = useState("");

  // NEW: Editable metadata fields
  const [posterUrl, setPosterUrl] = useState("");
  const [backdropUrl, setBackdropUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [overview, setOverview] = useState("");
  const [adminEdited, setAdminEdited] = useState(false);
  const [showEpisodeEditor, setShowEpisodeEditor] = useState(false);
  const [isRefreshingTmdb, setIsRefreshingTmdb] = useState(false);
  const [seasonCount, setSeasonCount] = useState("");
  const [episodeCount, setEpisodeCount] = useState("");

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingSeason, setIsDeletingSeason] = useState(false);
  const [seasonSaveProgress, setSeasonSaveProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // Restore panel state if the page is temporarily unmounted (e.g. admin check reruns)
  // and there is no explicit TMDB id coming from URL/prop.
  useEffect(() => {
    const idParam = (initialTmdbId ?? searchParams.get("id") ?? "").trim();
    if (idParam) return;

    try {
      const raw = sessionStorage.getItem(UPDATE_LINKS_CACHE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        timestamp: number;
        activeTab?: "update" | "trash" | "tools";
        tmdbId?: string;
        tmdbResult?: TMDBResult | null;
        candidates?: { movie: TMDBResult | null; series: TMDBResult | null };
        searchError?: string | null;
        entryExists?: boolean;
        selectedSeason?: number;
        movieWatchLink?: string;
        movieDownloadLink?: string;
        hoverImageUrl?: string;
        seriesWatchLinks?: string;
        seriesDownloadLinks?: string;
      };

      if (!parsed?.timestamp || Date.now() - parsed.timestamp > UPDATE_LINKS_CACHE_TTL_MS) {
        sessionStorage.removeItem(UPDATE_LINKS_CACHE_KEY);
        return;
      }

      if (parsed.activeTab) setActiveTab(parsed.activeTab);
      if (typeof parsed.tmdbId === "string") setTmdbId(parsed.tmdbId);
      if (typeof parsed.searchError !== "undefined") setSearchError(parsed.searchError ?? null);
      if (typeof parsed.entryExists === "boolean") setEntryExists(parsed.entryExists);
      if (typeof parsed.selectedSeason === "number") setSelectedSeason(parsed.selectedSeason);
      if (typeof parsed.movieWatchLink === "string") setMovieWatchLink(parsed.movieWatchLink);
      if (typeof parsed.movieDownloadLink === "string") setMovieDownloadLink(parsed.movieDownloadLink);
      if (typeof parsed.hoverImageUrl === "string") setHoverImageUrl(parsed.hoverImageUrl);
      if (typeof parsed.seriesWatchLinks === "string") setSeriesWatchLinks(parsed.seriesWatchLinks);
      if (typeof parsed.seriesDownloadLinks === "string") setSeriesDownloadLinks(parsed.seriesDownloadLinks);
      if (typeof parsed.tmdbResult !== "undefined") setTmdbResult(parsed.tmdbResult ?? null);
      if (typeof parsed.candidates !== "undefined") {
        setCandidates(
          parsed.candidates ?? {
            movie: null,
            series: null,
          }
        );
      }
    } catch {
      // ignore cache errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist state so switching tabs/minimizing doesn't wipe the current work.
  useEffect(() => {
    // Don't cache transient loading states.
    if (isSearching || isSaving || isDeleting || isDeletingSeason) return;

    const handle = window.setTimeout(() => {
      try {
        sessionStorage.setItem(
          UPDATE_LINKS_CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            activeTab,
            tmdbId,
            tmdbResult,
            candidates,
            searchError,
            entryExists,
            selectedSeason,
            movieWatchLink,
            movieDownloadLink,
            hoverImageUrl,
            seriesWatchLinks,
            seriesDownloadLinks,
          })
        );
      } catch {
        // ignore cache write errors
      }
    }, 200);

    return () => window.clearTimeout(handle);
  }, [
    activeTab,
    candidates,
    entryExists,
    hoverImageUrl,
    isDeleting,
    isDeletingSeason,
    isSaving,
    isSearching,
    movieDownloadLink,
    movieWatchLink,
    searchError,
    selectedSeason,
    seriesDownloadLinks,
    seriesWatchLinks,
    tmdbId,
    tmdbResult,
  ]);


  const loadSeasonData = useCallback(async (content: any, season: number) => {
    const seasonKey = `season_${season}`;
    const seasonData = content?.[seasonKey];

    if (seasonData) {
      setSeriesWatchLinks(seasonData.watch_links?.join("\n") || "");
      setSeriesDownloadLinks(seasonData.download_links?.join("\n") || "");
    } else {
      setSeriesWatchLinks("");
      setSeriesDownloadLinks("");
    }
  }, []);

  // Check DB for existing entry
  const checkAndLoadEntry = useCallback(
    async (result: TMDBResult, seasonForSeries: number) => {
      setMovieWatchLink("");
      setMovieDownloadLink("");
      setSeriesWatchLinks("");
      setSeriesDownloadLinks("");
      setHoverImageUrl("");
      setPosterUrl("");
      setBackdropUrl("");
      setLogoUrl("");
      setOverview("");
      setAdminEdited(false);
      setEntryExists(false);

      const entry = await fetchEntry(String(result.id));
      if (entry && entry.type === result.type) {
        setEntryExists(true);
        setHoverImageUrl(entry.hover_image_url || "");
        setPosterUrl(entry.poster_url || "");
        setBackdropUrl(entry.backdrop_url || "");
        setLogoUrl(entry.logo_url || "");
        setOverview(entry.overview || "");
        setAdminEdited(entry.admin_edited || false);

        if (entry.type === "movie") {
          const content = entry.content as { watch_link?: string; download_link?: string };
          setMovieWatchLink(content.watch_link || "");
          setMovieDownloadLink(content.download_link || "");
        } else if (entry.type === "series") {
          await loadSeasonData(entry.content, seasonForSeries);
        }
      }
    },
    [fetchEntry, loadSeasonData]
  );

  // Refresh metadata from TMDB
  const handleRefreshFromTmdb = async () => {
    if (!tmdbResult) return;
    setIsRefreshingTmdb(true);

    try {
      if (tmdbResult.type === "movie") {
        const [details, images] = await Promise.all([
          getMovieDetails(tmdbResult.id),
          getMovieImages(tmdbResult.id),
        ]);

        const logoPath = images.logos?.find((l) => l.iso_639_1 === "en")?.file_path ||
          images.logos?.find((l) => l.iso_639_1 == null)?.file_path ||
          images.logos?.[0]?.file_path;

        setPosterUrl(getImageUrl(details.poster_path, "w342") || "");
        setBackdropUrl(getImageUrl(details.backdrop_path, "original") || "");
        setLogoUrl(logoPath ? getImageUrl(logoPath, "w500") || "" : "");
        setOverview(details.overview || "");
      } else {
        const [details, images] = await Promise.all([
          getTVDetails(tmdbResult.id),
          getTVImages(tmdbResult.id),
        ]);

        const logoPath = images.logos?.find((l) => l.iso_639_1 === "en")?.file_path ||
          images.logos?.find((l) => l.iso_639_1 == null)?.file_path ||
          images.logos?.[0]?.file_path;

        setPosterUrl(getImageUrl(details.poster_path, "w342") || "");
        setBackdropUrl(getImageUrl(details.backdrop_path, "original") || "");
        setLogoUrl(logoPath ? getImageUrl(logoPath, "w500") || "" : "");
        setOverview(details.overview || "");
      }

      toast({
        title: "Refreshed",
        description: "Metadata fetched from TMDB. Click Save to persist.",
      });
    } catch (error) {
      console.error("Error refreshing from TMDB:", error);
      toast({
        title: "Error",
        description: "Failed to fetch from TMDB.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingTmdb(false);
    }
  };

  const handleSearch = useCallback(
    async (idOverride?: string) => {
      const id = (idOverride ?? tmdbId).trim();
      if (!id) return;

      setTmdbId(id);
      setIsSearching(true);
      setSearchError(null);
      setTmdbResult(null);
      setCandidates({ movie: null, series: null });
      setEntryExists(false);

      try {
        let movieCandidate: TMDBResult | null = null;
        let seriesCandidate: TMDBResult | null = null;

        // Fetch both Movie and TV details
        const [movieResult, tvResult] = await Promise.allSettled([getMovieDetails(Number(id)), getTVDetails(Number(id))]);

        // Process Movie
        if (movieResult.status === "fulfilled" && movieResult.value.title) {
          const movie = movieResult.value;
          const releaseYear = movie.release_date ? Number(movie.release_date.split("-")[0]) : null;

          movieCandidate = {
            id: movie.id,
            title: movie.title,
            posterUrl: getImageUrl(movie.poster_path, "w342"),
            year: movie.release_date?.split("-")[0] || "N/A",
            type: "movie",
            genreIds: movie.genres?.map((g: any) => g.id).filter(Boolean) ?? [],
            releaseYear: Number.isFinite(releaseYear as number) ? releaseYear : null,
          };
        }

        // Process Series
        if (tvResult.status === "fulfilled" && tvResult.value.name) {
          const show = tvResult.value;
          const validSeasons = show.seasons?.filter((s: any) => s.season_number > 0) || [];
          const releaseYear = show.first_air_date ? Number(show.first_air_date.split("-")[0]) : null;

          seriesCandidate = {
            id: show.id,
            title: show.name || "Unknown",
            posterUrl: getImageUrl(show.poster_path, "w342"),
            year: show.first_air_date?.split("-")[0] || "N/A",
            type: "series",
            genreIds: show.genres?.map((g: any) => g.id).filter(Boolean) ?? [],
            releaseYear: Number.isFinite(releaseYear as number) ? releaseYear : null,
            seasons: show.number_of_seasons,
            seasonDetails: validSeasons.map((s: any) => ({
              season_number: s.season_number,
              episode_count: s.episode_count,
            })),
          };
        }

        setCandidates({ movie: movieCandidate, series: seriesCandidate });

        // Auto-select logic
        let finalResult: TMDBResult | null = null;
        if (seriesCandidate && movieCandidate) {
          // Prefer series if it has seasons, otherwise movie
          finalResult = (seriesCandidate.seasons || 0) > 0 ? seriesCandidate : movieCandidate;
        } else {
          finalResult = movieCandidate || seriesCandidate;
        }

        if (!finalResult) throw new Error("Not found");

        // For series, choose a stable initial season before loading DB data
        let seasonForSeries = selectedSeason;
        if (finalResult.type === "series" && finalResult.seasonDetails?.length) {
          seasonForSeries = finalResult.seasonDetails[0].season_number;
          setSelectedSeason(seasonForSeries);
        }

        setTmdbResult(finalResult);

        // Check DB
        await checkAndLoadEntry(finalResult, seasonForSeries);
      } catch (error) {
        console.error("Search error:", error);
        setSearchError("Failed to find content with this TMDB ID. Please check the ID and try again.");
      } finally {
        setIsSearching(false);
      }
    },
    [checkAndLoadEntry, selectedSeason, tmdbId]
  );

  // MANUAL SWITCH HANDLER
  const handleManualSwitch = useCallback(
    async (type: "movie" | "series") => {
      const candidate = candidates[type];
      if (!candidate) return;

      setTmdbResult(candidate);

      let seasonForSeries = selectedSeason;

      // If switching to series, ensure a valid season is selected
      if (type === "series" && candidate.seasonDetails?.length) {
        const validSeason = candidate.seasonDetails.find((s) => s.season_number === selectedSeason);
        seasonForSeries = validSeason ? selectedSeason : candidate.seasonDetails[0].season_number;
        if (seasonForSeries !== selectedSeason) setSelectedSeason(seasonForSeries);
      }

      await checkAndLoadEntry(candidate, seasonForSeries);

      // If we switched to series and data exists, explicitly load season data again
      if (type === "series") {
        const entry = await fetchEntry(String(candidate.id));
        if (entry && entry.type === "series") {
          await loadSeasonData(entry.content, seasonForSeries);
        }
      }
    },
    [candidates, checkAndLoadEntry, fetchEntry, loadSeasonData, selectedSeason]
  );

  const didAutoSearchRef = useRef(false);

  // Auto-search on mount (page via URL param OR modal via prop)
  useEffect(() => {
    const idParam = (initialTmdbId ?? searchParams.get("id") ?? "").trim();
    if (!idParam) return;
    if (didAutoSearchRef.current) return;
    didAutoSearchRef.current = true;

    handleSearch(idParam);
  }, [handleSearch, initialTmdbId, searchParams]);


  const handleSeasonChange = async (season: string) => {
    const seasonNum = parseInt(season, 10);
    setSelectedSeason(seasonNum);

    if (tmdbResult && entryExists) {
      const entry = await fetchEntry(String(tmdbResult.id));
      if (entry?.type === "series") {
        await loadSeasonData(entry.content, seasonNum);
      }
    } else {
      setSeriesWatchLinks("");
      setSeriesDownloadLinks("");
    }
  };

  const handleSave = async () => {
    if (!tmdbResult) return;

    const trimmedHover = hoverImageUrl.trim();
    const isValidHover = !trimmedHover || /^https?:\/\//i.test(trimmedHover);
    if (!isValidHover) {
      toast({
        title: "Invalid URL",
        description: "Hover image URL must start with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    setSeasonSaveProgress(null);

    try {
      const media_updated_at = new Date().toISOString();

      const pickLogoUrl = (logos: { file_path: string; iso_639_1: string | null }[]) => {
        if (!logos?.length) return null;
        const preferred = logos.find((l) => l.iso_639_1 === "en") ?? logos.find((l) => l.iso_639_1 == null) ?? logos[0];
        return getImageUrl(preferred?.file_path ?? null, "w500");
      };

      if (tmdbResult.type === "movie") {
        // Fetch full TMDB details + images + credits to capture all metadata
        const [details, images, credits] = await Promise.all([
          getMovieDetails(tmdbResult.id),
          getMovieImages(tmdbResult.id),
          getMovieCredits(tmdbResult.id),
        ]);

        // Extract top 12 cast members
        const topCast = credits?.cast?.slice(0, 12).map((c) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profile_path: c.profile_path,
        })) || null;

        // Use custom URLs if provided, otherwise use TMDB
        const customPoster = posterUrl.trim();
        const customBackdrop = backdropUrl.trim();
        const customLogo = logoUrl.trim();

        const media = {
          poster_url: customPoster || getImageUrl(details.poster_path, "w342"),
          backdrop_url: customBackdrop || getImageUrl(details.backdrop_path, "original"),
          logo_url: customLogo || pickLogoUrl(images.logos),
          vote_average: typeof details.vote_average === "number" ? details.vote_average : null,
          vote_count: typeof (details as any).vote_count === "number" ? (details as any).vote_count : null,
          media_updated_at,
          // Extended metadata
          overview: overview.trim() || details.overview || null,
          tagline: details.tagline || null,
          runtime: details.runtime || null,
          status: details.status || null,
          genres: details.genres || null,
          cast_data: topCast,
        };

        const result = await saveMovieEntry(
          String(tmdbResult.id),
          movieWatchLink,
          movieDownloadLink,
          trimmedHover,
          tmdbResult.genreIds,
          tmdbResult.releaseYear ?? null,
          tmdbResult.title,
          details.original_language || null,
          details.production_countries?.map((c: any) => c.iso_3166_1) || null,
          media
        );
        if (result.success) {
          setEntryExists(true);
          // Update admin_edited flag if needed
          if (adminEdited) {
            await markEntryAdminEdited(String(tmdbResult.id), true);
          }
        }
      } else {
        // Fetch full TMDB details + images + credits to capture all metadata
        const [details, images, credits] = await Promise.all([
          getTVDetails(tmdbResult.id),
          getTVImages(tmdbResult.id),
          getTVCredits(tmdbResult.id),
        ]);

        // Extract top 12 cast members
        const topCast = credits?.cast?.slice(0, 12).map((c) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profile_path: c.profile_path,
        })) || null;

        const watchLinks = seriesWatchLinks.split("\n").filter((l) => l.trim());
        const downloadLinks = seriesDownloadLinks.split("\n").filter((l) => l.trim());

        // Use custom URLs if provided, otherwise use TMDB
        const customPoster = posterUrl.trim();
        const customBackdrop = backdropUrl.trim();
        const customLogo = logoUrl.trim();

        const media = {
          poster_url: customPoster || getImageUrl(details.poster_path, "w342"),
          backdrop_url: customBackdrop || getImageUrl(details.backdrop_path, "original"),
          logo_url: customLogo || pickLogoUrl(images.logos),
          vote_average: typeof details.vote_average === "number" ? details.vote_average : null,
          vote_count: typeof (details as any).vote_count === "number" ? (details as any).vote_count : null,
          media_updated_at,
          // Extended metadata
          overview: overview.trim() || details.overview || null,
          tagline: details.tagline || null,
          number_of_seasons: details.number_of_seasons || null,
          number_of_episodes: details.number_of_episodes || null,
          status: details.status || null,
          genres: details.genres || null,
          cast_data: topCast,
        };

        const result = await saveSeriesSeasonEntry(
          String(tmdbResult.id),
          selectedSeason,
          watchLinks,
          downloadLinks,
          trimmedHover,
          tmdbResult.genreIds,
          tmdbResult.releaseYear ?? null,
          tmdbResult.title,
          details.original_language || null,
          details.origin_country || null,
          media
        );
        if (result.success) {
          setEntryExists(true);

          // Auto-fetch and save episode metadata for ALL seasons if not admin-edited
          if (!adminEdited) {
            const validSeasons = details.seasons?.filter((s) => s.season_number > 0) || [];
            let totalEpisodesSaved = 0;

            for (let i = 0; i < validSeasons.length; i++) {
              const season = validSeasons[i];
              setSeasonSaveProgress({
                current: i + 1,
                total: validSeasons.length,
                message: `Saving Season ${season.season_number} of ${validSeasons.length}...`,
              });

              try {
                const seasonRes = await getTVSeasonDetails(tmdbResult.id, season.season_number);
                if (seasonRes?.episodes?.length) {
                  // Check which episodes already have admin_edited = true
                  const { data: existingEpisodes } = await supabase
                    .from("entry_metadata")
                    .select("episode_number, admin_edited")
                    .eq("entry_id", String(tmdbResult.id))
                    .eq("season_number", season.season_number);

                  const adminEditedEpisodes = new Set(
                    (existingEpisodes || []).filter((e) => e.admin_edited).map((e) => e.episode_number)
                  );

                  // Only save episodes that are NOT admin-edited
                  const episodesToSave = seasonRes.episodes
                    .filter((ep) => !adminEditedEpisodes.has(ep.episode_number))
                    .map((ep) => ({
                      episode_number: ep.episode_number,
                      name: ep.name || null,
                      overview: ep.overview || null,
                      still_path: ep.still_path ? getImageUrl(ep.still_path, "w300") : null,
                      air_date: ep.air_date || null,
                      runtime: ep.runtime || null,
                      vote_average: ep.vote_average ?? null,
                      admin_edited: false,
                    }));

                  if (episodesToSave.length > 0) {
                    await saveEpisodeMetadata(String(tmdbResult.id), season.season_number, episodesToSave);
                    totalEpisodesSaved += episodesToSave.length;
                  }
                }
              } catch (err) {
                console.error(`Error saving season ${season.season_number} metadata:`, err);
              }

              // Rate limit: 300ms between season fetches
              if (i < validSeasons.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 300));
              }
            }

            setSeasonSaveProgress(null);
            if (totalEpisodesSaved > 0) {
              toast({
                title: "Episodes Saved",
                description: `Saved ${validSeasons.length} seasons (${totalEpisodesSaved} episodes).`,
              });
            }
          }

          // Update admin_edited flag if needed
          if (adminEdited) {
            await markEntryAdminEdited(String(tmdbResult.id), true);
          }
        }
      }
    } catch (error) {
      console.error("Error in handleSave:", error);
    } finally {
      setIsSaving(false);
      setSeasonSaveProgress(null);
    }
  };

  const handleDeleteEntry = async () => {
    if (!tmdbResult) return;

    setIsDeleting(true);

    // Get the current entry data before deleting
    const entry = await fetchEntry(String(tmdbResult.id));
    if (entry) {
      // Move to trash
      moveToTrash({
        id: entry.id,
        type: entry.type,
        content: entry.content,
        title: tmdbResult.title,
        posterUrl: tmdbResult.posterUrl,
        deletedAt: new Date().toISOString(),
      });
    }

    const result = await deleteEntry(String(tmdbResult.id));
    if (result.success) {
      setEntryExists(false);
      setMovieWatchLink("");
      setMovieDownloadLink("");
      setSeriesWatchLinks("");
      setSeriesDownloadLinks("");
      toast({
        title: "Moved to Trash",
        description: "Entry has been moved to trash.",
      });
    }
    setIsDeleting(false);
  };

  const handleDeleteSeason = async () => {
    if (!tmdbResult) return;

    setIsDeletingSeason(true);
    const result = await deleteSeasonFromEntry(String(tmdbResult.id), selectedSeason);
    if (result.success) {
      setSeriesWatchLinks("");
      setSeriesDownloadLinks("");

      // Check if entry still exists
      const entry = await fetchEntry(String(tmdbResult.id));
      setEntryExists(!!entry);
    }
    setIsDeletingSeason(false);
  };

  const handleRestoreEntry = async (entry: TrashedEntry) => {
    // Restore to database
    const { error } = await supabase.from("entries").upsert({
      id: entry.id,
      type: entry.type,
      title: entry.title || null,
      content: entry.content,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to restore entry.",
        variant: "destructive",
      });
      return;
    }

    restoreFromTrash(entry.id);
    toast({
      title: "Entry Restored",
      description: `"${entry.title}" has been restored.`,
    });
  };

  const handlePermanentDelete = (entryId: string) => {
    permanentlyDelete(entryId);
    toast({
      title: "Permanently Deleted",
      description: "The entry has been permanently deleted.",
    });
  };

  const handleEmptyTrash = () => {
    emptyTrash();
    toast({
      title: "Trash Emptied",
      description: "All trashed entries have been permanently deleted.",
    });
  };

  // Paste handlers
  const handlePasteWatch = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (tmdbResult?.type === "movie") {
        setMovieWatchLink(text);
      } else {
        setSeriesWatchLinks(text);
      }
      toast({ title: "Pasted", description: "Content replaced from clipboard." });
    } catch {
      toast({ title: "Error", description: "Failed to read clipboard.", variant: "destructive" });
    }
  };

  const handlePasteDownload = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (tmdbResult?.type === "movie") {
        setMovieDownloadLink(text);
      } else {
        setSeriesDownloadLinks(text);
      }
      toast({ title: "Pasted", description: "Content replaced from clipboard." });
    } catch {
      toast({ title: "Error", description: "Failed to read clipboard.", variant: "destructive" });
    }
  };

  // Link counts
  const getWatchLinkCount = () => {
    if (tmdbResult?.type === "movie") {
      return movieWatchLink.trim() ? 1 : 0;
    }
    return seriesWatchLinks.split("\n").filter((l) => l.trim()).length;
  };

  const getDownloadLinkCount = () => {
    if (tmdbResult?.type === "movie") {
      return movieDownloadLink.trim() ? 1 : 0;
    }
    return seriesDownloadLinks.split("\n").filter((l) => l.trim()).length;
  };

  const getExpectedEpisodeCount = () => {
    if (!tmdbResult?.seasonDetails) return 0;
    const season = tmdbResult.seasonDetails.find((s) => s.season_number === selectedSeason);
    return season?.episode_count || 0;
  };

  // COMPACT EMBEDDED MODE - for Edit Mode modal
  if (embedded && tmdbResult) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        {/* Header with Poster, Info & Save Button */}
        <div className="flex items-start justify-between gap-4 p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {tmdbResult.posterUrl && (
              <img src={tmdbResult.posterUrl} alt={tmdbResult.title} className="w-20 h-28 object-cover rounded shadow-lg" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="font-bold text-lg truncate">{tmdbResult.title}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-white/10">{tmdbResult.year}</Badge>
                <Badge variant="outline" className="border-white/10">{tmdbResult.type === "movie" ? "Movie" : "Series"}</Badge>
                <Badge variant="secondary" className="bg-white/10">TMDB: {tmdbResult.id}</Badge>
                {entryExists && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    In Database
                  </Badge>
                )}
              </div>
              {/* Series Season Selector */}
              {tmdbResult.type === "series" && tmdbResult.seasonDetails && (
                <Select value={String(selectedSeason)} onValueChange={handleSeasonChange}>
                  <SelectTrigger className="w-48 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tmdbResult.seasonDetails.map((s) => (
                      <SelectItem key={s.season_number} value={String(s.season_number)}>
                        Season {s.season_number} ({s.episode_count} episodes)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Save Button - Top Right */}
          <Button onClick={handleSave} disabled={isSaving} className="bg-cinema-red hover:bg-cinema-red/90 shadow-lg">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Watch Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-300">Watch Online Links</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("border-white/10", getWatchLinkCount() > 0 ? "bg-green-500/10 text-green-400" : "bg-white/5")}>
                  {getWatchLinkCount()} link{getWatchLinkCount() !== 1 ? 's' : ''}
                </Badge>
                <Button variant="ghost" size="sm" onClick={handlePasteWatch} className="h-6 px-2 text-xs hover:bg-white/10">
                  <ClipboardPaste className="w-3 h-3 mr-1" /> Paste
                </Button>
              </div>
            </div>
            {tmdbResult.type === "movie" ? (
              <LineNumberedTextarea
                value={movieWatchLink}
                onChange={setMovieWatchLink}
                placeholder="https://..."
                className="min-h-[120px]"
              />
            ) : (
              <LineNumberedTextarea
                value={seriesWatchLinks}
                onChange={setSeriesWatchLinks}
                placeholder="One link per line..."
                className="min-h-[180px]"
              />
            )}
          </div>

          {/* Download Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-300">Download Links</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("border-white/10", getDownloadLinkCount() > 0 ? "bg-green-500/10 text-green-400" : "bg-white/5")}>
                  {getDownloadLinkCount()} link{getDownloadLinkCount() !== 1 ? 's' : ''}
                </Badge>
                <Button variant="ghost" size="sm" onClick={handlePasteDownload} className="h-6 px-2 text-xs hover:bg-white/10">
                  <ClipboardPaste className="w-3 h-3 mr-1" /> Paste
                </Button>
              </div>
            </div>
            {tmdbResult.type === "movie" ? (
              <LineNumberedTextarea
                value={movieDownloadLink}
                onChange={setMovieDownloadLink}
                placeholder="https://..."
                className="min-h-[120px]"
              />
            ) : (
              <LineNumberedTextarea
                value={seriesDownloadLinks}
                onChange={setSeriesDownloadLinks}
                placeholder="One link per line..."
                className="min-h-[180px]"
              />
            )}
          </div>
        </div>

        {/* Metadata Section */}
        <details className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg group">
          <summary className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors rounded-lg cursor-pointer list-none">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Advanced Metadata</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="p-4 pt-0 space-y-4 border-t border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="poster-url" className="text-xs">Poster URL</Label>
                <Input id="poster-url" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} className="bg-black/20 border-white/10 text-sm" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backdrop-url" className="text-xs">Backdrop URL</Label>
                <Input id="backdrop-url" value={backdropUrl} onChange={(e) => setBackdropUrl(e.target.value)} className="bg-black/20 border-white/10 text-sm" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo-url" className="text-xs">Logo URL</Label>
                <Input id="logo-url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="bg-black/20 border-white/10 text-sm" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hover-img" className="text-xs">Hover Character Image</Label>
                <Input id="hover-img" value={hoverImageUrl} onChange={(e) => setHoverImageUrl(e.target.value)} className="bg-black/20 border-white/10 text-sm" placeholder="https://..." />
              </div>
              {tmdbResult?.type === "series" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="season-count" className="text-xs">Number of Seasons</Label>
                    <Input id="season-count" type="number" value={seasonCount} onChange={(e) => setSeasonCount(e.target.value)} className="bg-black/20 border-white/10 text-sm" placeholder="e.g., 5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="episode-count" className="text-xs">Episodes (Current Season)</Label>
                    <Input id="episode-count" type="number" value={episodeCount} onChange={(e) => setEpisodeCount(e.target.value)} className="bg-black/20 border-white/10 text-sm" placeholder="e.g., 10" />
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="overview" className="text-xs">Overview</Label>
              <Textarea id="overview" value={overview} onChange={(e) => setOverview(e.target.value)} className="bg-black/20 border-white/10 text-sm" rows={3} placeholder="Enter overview..." />
            </div>
            {tmdbResult?.type === "series" && (
              <div className="pt-2 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEpisodeEditor(true)}
                  className="w-full bg-black/20 hover:bg-black/30"
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  Edit Episode Metadata
                </Button>
              </div>
            )}
          </div>
        </details>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2">
          {entryExists && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-white hover:bg-destructive/80">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Move to Trash
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move the entry to trash. You can restore it later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    );
  }

  // FULL MODE - for standalone page
  return (
    <div className={cn("relative min-h-screen", className)}>
      {!embedded && (
        <div className="flex items-start gap-4 mb-8 pt-4">
          <Button variant="ghost" size="icon" asChild className="hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <Link to="/admin">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cinema-red/20 text-cinema-red">
                <Link2 className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Update Links</h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Manage watch and download links for movies and series</p>
          </div>
        </div>
      )}

      {/* Modern Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "update" | "trash" | "tools")} className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList className="bg-black/40 border border-white/10 p-1 rounded-full backdrop-blur-md">
            <TabsTrigger
              value="update"
              className="rounded-full px-6 py-2 data-[state=active]:bg-cinema-red data-[state=active]:text-white transition-all duration-300"
            >
              <Link2 className="w-4 h-4 mr-2" />
              Update Links
            </TabsTrigger>
            <TabsTrigger
              value="trash"
              className="rounded-full px-6 py-2 data-[state=active]:bg-cinema-red data-[state=active]:text-white transition-all duration-300"
            >
              <Archive className="w-4 h-4 mr-2" />
              Trash ({trashedEntries.length})
            </TabsTrigger>
            <TabsTrigger
              value="tools"
              className="rounded-full px-6 py-2 data-[state=active]:bg-cinema-red data-[state=active]:text-white transition-all duration-300"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Tools
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="update" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Hero Search Section */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cinema-red/50 to-purple-500/50 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur-lg" />
            <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-2 sm:p-4 flex gap-4 shadow-2xl">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  className="w-full bg-white/5 border-white/10 pl-12 h-14 text-lg rounded-lg focus:ring-cinema-red/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder="Enter TMDB ID to start editing..."
                  value={tmdbId}
                  onChange={(e) => setTmdbId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button
                onClick={() => handleSearch()}
                disabled={isSearching || !tmdbId.trim()}
                className="h-14 px-8 bg-cinema-red hover:bg-cinema-red/90 text-white rounded-lg font-semibold shadow-lg shadow-cinema-red/20 transition-all hover:scale-105"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                <span className="ml-2 hidden sm:inline">Search</span>
              </Button>
            </div>
            {searchError && (
              <div className="absolute -bottom-8 left-4 text-sm text-red-400 font-medium flex items-center animate-in slide-in-from-left-2">
                <X className="w-4 h-4 mr-1" /> {searchError}
              </div>
            )}
          </div>

          {/* Main Content Area */}
          {tmdbResult && (
            <div className="grid grid-cols-1 lg:grid-cols-[350px,1fr] gap-6 items-start animate-in fade-in duration-500">

              {/* Left Column: Poster & Quick Info */}
              <div className="space-y-6">
                <div className="relative bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden p-4 shadow-xl">
                  {/* Poster Image */}
                  <div className="aspect-[2/3] relative rounded-xl overflow-hidden shadow-2xl mb-4 group">
                    <img
                      src={tmdbResult.posterUrl || ""}
                      alt={tmdbResult.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      <Badge className={entryExists ? "bg-green-500/90" : "bg-cinema-red/90"}>
                        {entryExists ? "In Database" : "New Entry"}
                      </Badge>
                    </div>
                  </div>

                  {/* Title & Meta */}
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold leading-tight">{tmdbResult.title}</h2>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="border-white/10 bg-white/5">
                        {tmdbResult.year}
                      </Badge>
                      <Badge variant="outline" className="border-white/10 bg-white/5">
                        {tmdbResult.type === "movie" ? "Movie" : "Series"}
                      </Badge>
                      <Badge variant="secondary" className="bg-white/10">TMDB: {tmdbResult.id}</Badge>
                    </div>
                  </div>

                  {/* Type Switcher */}
                  <div className="flex gap-2 mt-6 p-1 bg-black/40 rounded-lg">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleManualSwitch("movie")}
                      disabled={!candidates.movie}
                      className={cn(
                        "flex-1 rounded-md transition-all",
                        tmdbResult.type === "movie" ? "bg-cinema-red text-white shadow-md" : "text-muted-foreground hover:text-white"
                      )}
                    >
                      <Film className="w-4 h-4 mr-2" />
                      Movie
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleManualSwitch("series")}
                      disabled={!candidates.series}
                      className={cn(
                        "flex-1 rounded-md transition-all",
                        tmdbResult.type === "series" ? "bg-cinema-red text-white shadow-md" : "text-muted-foreground hover:text-white"
                      )}
                    >
                      <Tv className="w-4 h-4 mr-2" />
                      Series
                    </Button>
                  </div>
                </div>

                {/* Series Season Selector */}
                {tmdbResult.type === "series" && tmdbResult.seasonDetails && (
                  <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">Active Season</Label>
                    <Select value={String(selectedSeason)} onValueChange={handleSeasonChange}>
                      <SelectTrigger className="w-full bg-white/5 border-white/10 h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tmdbResult.seasonDetails.map((s) => (
                          <SelectItem key={s.season_number} value={String(s.season_number)}>
                            Season {s.season_number} <span className="text-muted-foreground ml-2">({s.episode_count} eps)</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Right Column: Forms */}
              <div className="space-y-6">

                {/* 1. Links Management */}
                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                      <FileVideo className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-semibold">Streaming Links</h3>
                  </div>

                  {/* Watch Links */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-muted-foreground">Stream URLs</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("border-white/10", getWatchLinkCount() > 0 ? "bg-green-500/10 text-green-400" : "bg-white/5")}>
                          {getWatchLinkCount()} added
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={handlePasteWatch} className="h-6 px-2 text-xs hover:bg-white/10">
                          <ClipboardPaste className="w-3 h-3 mr-1" /> Paste
                        </Button>
                      </div>
                    </div>
                    {tmdbResult.type === "movie" ? (
                      <LineNumberedTextarea
                        value={movieWatchLink}
                        onChange={setMovieWatchLink}
                        placeholder="https://..."
                        className="min-h-[80px]"
                      />
                    ) : (
                      <LineNumberedTextarea
                        value={seriesWatchLinks}
                        onChange={setSeriesWatchLinks}
                        placeholder="One link per line..."
                        className="min-h-[120px]"
                      />
                    )}
                  </div>

                  {/* Download Links */}
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-muted-foreground">Download URLs</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("border-white/10", getDownloadLinkCount() > 0 ? "bg-green-500/10 text-green-400" : "bg-white/5")}>
                          {getDownloadLinkCount()} added
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={handlePasteDownload} className="h-6 px-2 text-xs hover:bg-white/10">
                          <ClipboardPaste className="w-3 h-3 mr-1" /> Paste
                        </Button>
                      </div>
                    </div>
                    {tmdbResult.type === "movie" ? (
                      <LineNumberedTextarea
                        value={movieDownloadLink}
                        onChange={setMovieDownloadLink}
                        placeholder="https://..."
                        className="min-h-[80px]"
                      />
                    ) : (
                      <LineNumberedTextarea
                        value={seriesDownloadLinks}
                        onChange={setSeriesDownloadLinks}
                        placeholder="One link per line..."
                        className="min-h-[120px]"
                      />
                    )}
                  </div>
                </div>

                {/* 2. Metadata Editor */}
                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-semibold">Metadata & Assets</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshFromTmdb}
                      disabled={isRefreshingTmdb}
                      className="hover:bg-white/5"
                    >
                      {isRefreshingTmdb ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Poster URL</Label>
                      <Input value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} className="bg-white/5 border-white/10 font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Backdrop URL</Label>
                      <Input value={backdropUrl} onChange={(e) => setBackdropUrl(e.target.value)} className="bg-white/5 border-white/10 font-mono text-xs" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Hover Image (Optional)</Label>
                    <div className="flex gap-2">
                      <Input value={hoverImageUrl} onChange={(e) => setHoverImageUrl(e.target.value)} className="bg-white/5 border-white/10 font-mono text-xs flex-1" placeholder="https://..." />
                      {hoverImageUrl && <img src={hoverImageUrl} className="w-10 h-10 rounded object-cover border border-white/10" />}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-base">Admin Locked</Label>
                        <p className="text-xs text-muted-foreground">Prevent auto-updates from overriding these changes</p>
                      </div>
                      <Switch checked={adminEdited} onCheckedChange={setAdminEdited} />
                    </div>

                    {tmdbResult.type === "series" && (
                      <Button variant="outline" onClick={() => setShowEpisodeEditor(true)} className="w-full border-white/10 hover:bg-white/5">
                        <ImageIcon className="w-4 h-4 mr-2" /> Manage Episode Thumbnails
                      </Button>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="sticky bottom-6 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 z-50">
                  <div className="flex items-center gap-2">
                    {seasonSaveProgress && (
                      <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full">
                        <Loader2 className="w-4 h-4 animate-spin text-cinema-red" />
                        <span className="text-xs font-medium">{seasonSaveProgress.message}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {entryExists && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-red-500/20 text-muted-foreground hover:text-red-400 rounded-full w-10 h-10">
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
                            <AlertDialogDescription>This will move existing links to trash.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteEntry} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <Button onClick={handleSave} disabled={isSaving} className="bg-white text-black hover:bg-white/90 px-8 rounded-full font-bold shadow-lg shadow-white/10">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </TabsContent>

        {/* Trash Content */}
        <TabsContent value="trash" className="animate-in slide-in-from-bottom-4 duration-500">
          {/* Trash Logic (Restyled) */}
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                disabled={trashedEntries.length === 0}
                onClick={() => {
                  if (confirm("Empty trash?")) handleEmptyTrash();
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Empty Trash
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trashedEntries.map((entry) => (
                <div key={entry.id} className="bg-black/40 border border-white/10 rounded-xl overflow-hidden group">
                  <div className="flex gap-4 p-4">
                    <img src={entry.posterUrl || ""} className="w-16 h-24 object-cover rounded-md bg-white/5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold truncate">{entry.title}</h4>
                      <div className="text-xs text-muted-foreground mt-1">
                        Deleted {formatDistanceToNow(new Date(entry.deletedAt), { addSuffix: true })}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="secondary" className="h-7 text-xs bg-white/10 hover:bg-white/20" onClick={() => handleRestoreEntry(entry)}>
                          Restore
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {trashedEntries.length === 0 && (
                <div className="col-span-full py-20 text-center text-muted-foreground bg-white/5 rounded-2xl border border-dashed border-white/10">
                  <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Trash is empty</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tools" className="animate-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8">
          <ManifestUpdateTool />
          <PostMetadataEditor />
        </TabsContent>
      </Tabs>

      {/* Episode Modal */}
      {tmdbResult && tmdbResult.type === "series" && (
        <EpisodeMetadataEditor
          open={showEpisodeEditor}
          onOpenChange={setShowEpisodeEditor}
          entryId={String(tmdbResult.id)}
          entryTitle={tmdbResult.title}
          seasonDetails={tmdbResult.seasonDetails}
        />
      )}
    </div>
  );
}
