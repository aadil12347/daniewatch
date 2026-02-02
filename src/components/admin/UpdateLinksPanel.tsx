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
import { MetadataPrefillTool } from "@/components/admin/MetadataPrefillTool";
import { EpisodeMetadataEditor } from "@/components/admin/EpisodeMetadataEditor";
import { Progress } from "@/components/ui/progress";

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

  return (
    <div className={className}>
      {!embedded && (
        <div className="flex items-start gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <Link2 className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Update Links</h1>
              </div>
              <p className="text-muted-foreground mt-1">Manage watch and download links for movies and series</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "update" | "trash" | "tools")} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="update" className="gap-2">
            <Link2 className="w-4 h-4" />
            Update Links
          </TabsTrigger>
          <TabsTrigger value="trash" className="gap-2">
            <Archive className="w-4 h-4" />
            Trash ({trashedEntries.length})
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <Wrench className="w-4 h-4" />
            Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="update" className="space-y-4">
          {/* Search Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Search by TMDB ID</CardTitle>
              <CardDescription>Enter the TMDB ID and press Search or Enter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter TMDB ID (e.g., 93405)"
                    value={tmdbId}
                    onChange={(e) => setTmdbId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={() => handleSearch()} disabled={isSearching || !tmdbId.trim()}>
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2">Search</span>
                </Button>
              </div>

              {searchError && <p className="text-sm text-destructive mt-2">{searchError}</p>}
            </CardContent>
          </Card>

          {/* Links Form - Always visible */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* Hover character image */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Hover character image (optional)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        setHoverImageUrl(text);
                        toast({ title: "Pasted", description: "Hover image URL replaced from clipboard." });
                      } catch {
                        toast({ title: "Error", description: "Failed to read clipboard.", variant: "destructive" });
                      }
                    }}
                    className="gap-1 h-7 px-2"
                    disabled={!tmdbResult}
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    Paste
                  </Button>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <Input
                      value={hoverImageUrl}
                      onChange={(e) => setHoverImageUrl(e.target.value)}
                      className="font-mono text-sm"
                      placeholder="https://... (PNG/WebP/JPG recommended)"
                      disabled={!tmdbResult}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Shown to everyone on card hover.</p>
                  </div>

                  {/^https?:\/\//i.test(hoverImageUrl.trim()) && (
                    <img
                      src={hoverImageUrl.trim()}
                      alt="Hover character preview"
                      loading="lazy"
                      className="w-12 h-12 rounded-md object-cover border"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Watch Online */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Watch Online</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {getWatchLinkCount()} links
                      {tmdbResult && tmdbResult.type === "series" && ` / ${getExpectedEpisodeCount()} ep`}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handlePasteWatch} className="gap-1 h-7 px-2">
                      <ClipboardPaste className="w-3 h-3" />
                      Paste
                    </Button>
                  </div>
                </div>
                {tmdbResult?.type === "movie" ? (
                  <Textarea
                    value={movieWatchLink}
                    onChange={(e) => setMovieWatchLink(e.target.value)}
                    className="min-h-[80px] font-mono text-sm"
                    placeholder="Paste watch link here..."
                  />
                ) : (
                  <Textarea
                    value={seriesWatchLinks}
                    onChange={(e) => setSeriesWatchLinks(e.target.value)}
                    className="font-mono text-sm"
                    style={{ minHeight: Math.max(80, Math.min(300, getWatchLinkCount() * 24 + 40)) }}
                    placeholder="Paste episode links here (one per line)..."
                  />
                )}
              </div>

              {/* Download Links */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Download Links</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{getDownloadLinkCount()} links</span>
                    <Button variant="ghost" size="sm" onClick={handlePasteDownload} className="gap-1 h-7 px-2">
                      <ClipboardPaste className="w-3 h-3" />
                      Paste
                    </Button>
                  </div>
                </div>
                {tmdbResult?.type === "movie" ? (
                  <Input
                    value={movieDownloadLink}
                    onChange={(e) => setMovieDownloadLink(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="Paste download link here..."
                  />
                ) : (
                  <Textarea
                    value={seriesDownloadLinks}
                    onChange={(e) => setSeriesDownloadLinks(e.target.value)}
                    className="font-mono text-sm"
                    style={{ minHeight: Math.max(80, Math.min(300, getDownloadLinkCount() * 24 + 40)) }}
                    placeholder="Paste download links here (one per line)..."
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Result Card with Type Toggle */}
          {tmdbResult && (
            <Card>
              <CardContent className="pt-4">
                {/* Manual Toggle Buttons */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={tmdbResult.type === "movie" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleManualSwitch("movie")}
                    disabled={!candidates.movie}
                    className="flex-1"
                  >
                    <Film className="w-4 h-4 mr-2" />
                    Movie {candidates.movie ? "" : "(N/A)"}
                  </Button>
                  <Button
                    variant={tmdbResult.type === "series" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleManualSwitch("series")}
                    disabled={!candidates.series}
                    className="flex-1"
                  >
                    <Tv className="w-4 h-4 mr-2" />
                    Series {candidates.series ? "" : "(N/A)"}
                  </Button>
                </div>

                <div className="flex gap-4 items-start">
                  {/* Small Poster */}
                  <div className="flex-shrink-0">
                    {tmdbResult.posterUrl ? (
                      <img
                        src={tmdbResult.posterUrl}
                        alt={tmdbResult.title}
                        className="w-16 h-24 object-cover rounded-lg shadow-md"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-16 h-24 bg-secondary rounded-lg flex items-center justify-center">
                        {tmdbResult.type === "movie" ? (
                          <Film className="w-6 h-6 text-muted-foreground" />
                        ) : (
                          <Tv className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">{tmdbResult.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {tmdbResult.year} • {tmdbResult.type === "movie" ? "Movie" : "Series"}
                    </p>

                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline" className="text-xs">
                        TMDB: {tmdbResult.id}
                      </Badge>
                      {entryExists ? (
                        <Badge variant="default" className="bg-green-500 text-xs">
                          Exists
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          New
                        </Badge>
                      )}
                    </div>

                    {/* Season selector for series */}
                    {tmdbResult.type === "series" && tmdbResult.seasonDetails && (
                      <div className="mt-2">
                        <Select value={String(selectedSeason)} onValueChange={handleSeasonChange}>
                          <SelectTrigger className="w-full h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {tmdbResult.seasonDetails.map((s) => (
                              <SelectItem key={s.season_number} value={String(s.season_number)}>
                                S{s.season_number} ({s.episode_count} ep)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata Editing Section */}
          {tmdbResult && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    <CardTitle className="text-lg">Metadata</CardTitle>
                    {adminEdited && (
                      <Badge variant="secondary" className="text-xs">
                        Admin Edited
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshFromTmdb}
                    disabled={isRefreshingTmdb}
                  >
                    {isRefreshingTmdb ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="ml-1">Refresh TMDB</span>
                  </Button>
                </div>
                <CardDescription>
                  Edit poster, backdrop, logo URLs and description. Changes are saved with the entry.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Poster URL */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Poster URL</Label>
                  <div className="flex gap-3 items-start">
                    <Input
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      className="flex-1 font-mono text-xs"
                      placeholder="https://..."
                    />
                    {posterUrl && /^https?:\/\//i.test(posterUrl) && (
                      <img
                        src={posterUrl}
                        alt="Poster preview"
                        className="w-10 h-14 object-cover rounded border"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>
                </div>

                {/* Backdrop URL */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Backdrop URL</Label>
                  <div className="flex gap-3 items-start">
                    <Input
                      value={backdropUrl}
                      onChange={(e) => setBackdropUrl(e.target.value)}
                      className="flex-1 font-mono text-xs"
                      placeholder="https://..."
                    />
                    {backdropUrl && /^https?:\/\//i.test(backdropUrl) && (
                      <img
                        src={backdropUrl}
                        alt="Backdrop preview"
                        className="w-20 h-11 object-cover rounded border"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>
                </div>

                {/* Logo URL */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Logo URL</Label>
                  <div className="flex gap-3 items-start">
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="flex-1 font-mono text-xs"
                      placeholder="https://..."
                    />
                    {logoUrl && /^https?:\/\//i.test(logoUrl) && (
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="h-8 object-contain"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>
                </div>

                {/* Overview */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Overview / Description</Label>
                  <Textarea
                    value={overview}
                    onChange={(e) => setOverview(e.target.value)}
                    rows={3}
                    placeholder="Description..."
                  />
                </div>

                {/* Admin Edited Toggle */}
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Switch
                    id="admin-edited"
                    checked={adminEdited}
                    onCheckedChange={setAdminEdited}
                  />
                  <Label htmlFor="admin-edited" className="text-sm cursor-pointer">
                    Mark as Admin Edited (skips auto-prefill)
                  </Label>
                </div>

                {/* Episode Editor Button (series only) */}
                {tmdbResult.type === "series" && tmdbResult.seasonDetails && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setShowEpisodeEditor(true)}
                      className="w-full"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Manage Episode Metadata
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {tmdbResult && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {tmdbResult.type === "series" 
                  ? (seasonSaveProgress ? seasonSaveProgress.message : "Save Entry + All Seasons")
                  : "Save Entry"}
              </Button>

              {/* Season save progress indicator */}
              {seasonSaveProgress && (
                <div className="flex items-center gap-3 flex-1 ml-2">
                  <Progress 
                    value={(seasonSaveProgress.current / seasonSaveProgress.total) * 100} 
                    className="flex-1 h-2"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {seasonSaveProgress.current}/{seasonSaveProgress.total}
                  </span>
                </div>
              )}

              {entryExists && tmdbResult.type === "series" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive" disabled={isDeletingSeason}>
                      {isDeletingSeason ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Delete Season {selectedSeason}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Season {selectedSeason}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete all watch and download links for Season {selectedSeason}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteSeason}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Season
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {entryExists && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Delete Entire Entry
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will move all watch and download links for "{tmdbResult.title}" to trash.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteEntry}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Move to Trash
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trash" className="space-y-6">
          {/* Trash Actions */}
          <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={trashedEntries.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Empty Trash
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Empty Trash?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to permanently delete {trashedEntries.length} entries? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleEmptyTrash}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Empty Trash
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Trash List */}
          {trashedEntries.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Archive className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Trash is empty</h2>
                <p className="text-muted-foreground">Deleted entries will appear here for recovery.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {trashedEntries.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="pt-6">
                    <div className="flex gap-4 items-start">
                      {entry.posterUrl ? (
                        <img
                          src={entry.posterUrl}
                          alt={entry.title}
                          className="w-16 h-24 object-cover rounded-lg"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 h-24 bg-secondary rounded-lg flex items-center justify-center">
                          {entry.type === "movie" ? (
                            <Film className="w-6 h-6 text-muted-foreground" />
                          ) : (
                            <Tv className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                      )}

                      <div className="flex-1">
                        <h3 className="font-semibold">{entry.title}</h3>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">{entry.type === "movie" ? "Movie" : "Series"}</Badge>
                          <Badge variant="secondary">ID: {entry.id}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Deleted {formatDistanceToNow(new Date(entry.deletedAt), { addSuffix: true })}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleRestoreEntry(entry)} className="gap-1">
                          <RotateCcw className="w-4 h-4" /> Restore
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1">
                              <Trash2 className="w-4 h-4" /> Delete Forever
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Permanently Delete</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete "{entry.title}"? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handlePermanentDelete(entry.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Forever
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <ManifestUpdateTool />
          <MetadataPrefillTool />
        </TabsContent>
      </Tabs>

      {/* Episode Metadata Editor Modal */}
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
