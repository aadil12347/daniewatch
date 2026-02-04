import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
  Search,
  Loader2,
  Save,
  RefreshCw,
  Film,
  Tv,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Database,
  Globe,
  Pencil,
  Image as ImageIcon,
  Filter,
  Plus,
  Trash2,
  SortAsc,
  SortDesc,
  Clock,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEntryMetadata, EpisodeMetadata, SaveEpisodeInput } from "@/hooks/useEntryMetadata";
import { EntryData, CastMember, Genre } from "@/hooks/useEntries";
import {
  getMovieDetails,
  getMovieImages,
  getMovieCredits,
  getTVDetails,
  getTVImages,
  getTVCredits,
  getTVSeasonDetails,
  getImageUrl,
  searchMergedGlobal,
  Movie,
} from "@/lib/tmdb";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Standard TMDB Genres
const TMDB_GENRES: Genre[] = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
  // TV-specific
  { id: 10759, name: "Action & Adventure" },
  { id: 10762, name: "Kids" },
  { id: 10763, name: "News" },
  { id: 10764, name: "Reality" },
  { id: 10765, name: "Sci-Fi & Fantasy" },
  { id: 10766, name: "Soap" },
  { id: 10767, name: "Talk" },
  { id: 10768, name: "War & Politics" },
];

// Cache keys and TTL
const EDITOR_CACHE_KEY = "postMetadataEditorState_v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SearchResult {
  id: string;
  type: "movie" | "series";
  title: string;
  posterUrl: string | null;
  year: string;
  inDb: boolean;
  hasLinks: boolean;
  missingFields?: string[];
  adminEdited?: boolean;
  // Full metadata from DB (for entries with links)
  backdropUrl?: string | null;
  logoUrl?: string | null;
  overview?: string | null;
  tagline?: string | null;
  status?: string | null;
  voteAverage?: number | null;
  runtime?: number | null;
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
  genres?: Genre[];
  castData?: CastMember[];
}

type FilterType = "all" | "movie" | "series";
type SortBy = "recent" | "year_desc" | "year_asc" | "name" | "rating" | "missing";
type RecentlyEditedFilter = "all" | "24h" | "7d" | "30d";
type LinksFilter = "all" | "with_links" | "without_links";

interface FilterState {
  type: FilterType;
  sortBy: SortBy;
  recentlyEdited: RecentlyEditedFilter;
  linksFilter: LinksFilter;
  missingPoster: boolean;
  missingBackdrop: boolean;
  missingLogo: boolean;
  missingOverview: boolean;
  missingGenres: boolean;
  missingCast: boolean;
}

interface EditorCacheState {
  timestamp: number;
  searchQuery: string;
  searchResults: SearchResult[];
  selectedEntryId: string | null;
  selectedEntryType: "movie" | "series" | null;
  title: string;
  posterUrl: string;
  backdropUrl: string;
  logoUrl: string;
  overview: string;
  tagline: string;
  status: string;
  voteAverage: number | null;
  runtime: number | null;
  releaseYear: number | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  genres: Genre[];
  selectedSeason: number;
  filterState: FilterState;
}

export function PostMetadataEditor() {
  const { toast } = useToast();
  const { fetchAllEpisodeMetadata, saveEpisodeMetadata, saveSingleEpisode } = useEntryMetadata();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]); // DB results
  const [tmdbResults, setTmdbResults] = useState<SearchResult[]>([]); // TMDB results (separate)
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);

  // Filter state
  const [filterState, setFilterState] = useState<FilterState>({
    type: "all",
    sortBy: "recent",
    recentlyEdited: "all",
    linksFilter: "all",
    missingPoster: false,
    missingBackdrop: false,
    missingLogo: false,
    missingOverview: false,
    missingGenres: false,
    missingCast: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Selected entry state
  const [selectedEntry, setSelectedEntry] = useState<EntryData | null>(null);
  const [isLoadingEntry, setIsLoadingEntry] = useState(false);

  // Editable metadata fields
  const [title, setTitle] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [backdropUrl, setBackdropUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [overview, setOverview] = useState("");
  const [tagline, setTagline] = useState("");
  const [status, setStatus] = useState("");
  const [voteAverage, setVoteAverage] = useState<number | null>(null);
  const [runtime, setRuntime] = useState<number | null>(null);
  const [releaseYear, setReleaseYear] = useState<number | null>(null);
  const [numberOfSeasons, setNumberOfSeasons] = useState<number | null>(null);
  const [numberOfEpisodes, setNumberOfEpisodes] = useState<number | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [castData, setCastData] = useState<CastMember[]>([]);
  const [adminEdited, setAdminEdited] = useState(false);

  // Episode state
  const [episodes, setEpisodes] = useState<EpisodeMetadata[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [expandedEpisode, setExpandedEpisode] = useState<number | null>(null);
  const [isMainMetadataOpen, setIsMainMetadataOpen] = useState(true);
  const [expandedSeasons, setExpandedSeasons] = useState<number[]>([1]);

  // Season/Episode management
  const [showAddSeasonDialog, setShowAddSeasonDialog] = useState(false);
  const [newSeasonNumber, setNewSeasonNumber] = useState<number>(1);
  const [showDeleteSeasonConfirm, setShowDeleteSeasonConfirm] = useState(false);
  const [showAddEpisodeDialog, setShowAddEpisodeDialog] = useState(false);
  const [newEpisodeNumber, setNewEpisodeNumber] = useState<number>(1);
  const [showDeleteEpisodeConfirm, setShowDeleteEpisodeConfirm] = useState<EpisodeMetadata | null>(null);

  // Genre modal state
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [genreSearch, setGenreSearch] = useState("");
  const [newCustomGenre, setNewCustomGenre] = useState("");
  const [tempSelectedGenres, setTempSelectedGenres] = useState<Genre[]>([]);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EDITOR_CACHE_KEY);
      if (!raw) return;

      const cached: EditorCacheState = JSON.parse(raw);
      if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        sessionStorage.removeItem(EDITOR_CACHE_KEY);
        return;
      }

      // Restore state
      if (cached.searchQuery) setSearchQuery(cached.searchQuery);
      if (cached.searchResults) setSearchResults(cached.searchResults);
      if (cached.title) setTitle(cached.title);
      if (cached.posterUrl) setPosterUrl(cached.posterUrl);
      if (cached.backdropUrl) setBackdropUrl(cached.backdropUrl);
      if (cached.logoUrl) setLogoUrl(cached.logoUrl);
      if (cached.overview) setOverview(cached.overview);
      if (cached.tagline) setTagline(cached.tagline);
      if (cached.status) setStatus(cached.status);
      if (cached.voteAverage !== undefined) setVoteAverage(cached.voteAverage);
      if (cached.runtime !== undefined) setRuntime(cached.runtime);
      if (cached.releaseYear !== undefined) setReleaseYear(cached.releaseYear);
      if (cached.numberOfSeasons !== undefined) setNumberOfSeasons(cached.numberOfSeasons);
      if (cached.numberOfEpisodes !== undefined) setNumberOfEpisodes(cached.numberOfEpisodes);
      if (cached.genres) setGenres(cached.genres);
      if (cached.selectedSeason) setSelectedSeason(cached.selectedSeason);
      if (cached.filterState) setFilterState(cached.filterState);

      // Restore selected entry if present
      if (cached.selectedEntryId && cached.selectedEntryType) {
        handleSelectEntry({
          id: cached.selectedEntryId,
          type: cached.selectedEntryType,
          title: cached.title || "",
          posterUrl: cached.posterUrl || null,
          year: cached.releaseYear?.toString() || "",
          inDb: true,
          hasLinks: true, // Assume from cache
        });
      }
    } catch (e) {
      console.warn("Failed to restore editor state:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save state to sessionStorage on changes (debounced)
  useEffect(() => {
    if (isSearchingDb || isSearchingTmdb || isLoadingEntry || isSaving || isSyncing) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const stateToSave: EditorCacheState = {
          timestamp: Date.now(),
          searchQuery,
          searchResults,
          selectedEntryId: selectedEntry?.id || null,
          selectedEntryType: selectedEntry?.type || null,
          title,
          posterUrl,
          backdropUrl,
          logoUrl,
          overview,
          tagline,
          status,
          voteAverage,
          runtime,
          releaseYear,
          numberOfSeasons,
          numberOfEpisodes,
          genres,
          selectedSeason,
          filterState,
        };
        sessionStorage.setItem(EDITOR_CACHE_KEY, JSON.stringify(stateToSave));
      } catch (e) {
        console.warn("Failed to save editor state:", e);
      }
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    searchQuery,
    searchResults,
    selectedEntry,
    title,
    posterUrl,
    backdropUrl,
    logoUrl,
    overview,
    tagline,
    status,
    voteAverage,
    runtime,
    releaseYear,
    numberOfSeasons,
    numberOfEpisodes,
    genres,
    selectedSeason,
    filterState,
    isSearchingDb,
    isSearchingTmdb,
    isLoadingEntry,
    isSaving,
    isSyncing,
  ]);

  // Get available seasons from entry content
  const availableSeasons = useMemo(() => {
    if (!selectedEntry || selectedEntry.type !== "series") return [];
    const content = selectedEntry.content as Record<string, any>;
    const seasons = Object.keys(content)
      .filter((k) => k.startsWith("season_"))
      .map((k) => parseInt(k.replace("season_", ""), 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);

    // Also include seasons from episodes
    const episodeSeasons = [...new Set(episodes.map((ep) => ep.season_number))];
    episodeSeasons.forEach((s) => {
      if (!seasons.includes(s)) seasons.push(s);
    });

    // Also include seasons from number_of_seasons if higher
    if (numberOfSeasons) {
      for (let i = 1; i <= numberOfSeasons; i++) {
        if (!seasons.includes(i)) seasons.push(i);
      }
    }

    seasons.sort((a, b) => a - b);
    return seasons.length > 0 ? seasons : [1];
  }, [selectedEntry, episodes, numberOfSeasons]);

  // Calculate missing fields for an entry
  const calculateMissingFields = (entry: any): string[] => {
    const missing: string[] = [];
    if (!entry.poster_url) missing.push("Poster");
    if (!entry.backdrop_url) missing.push("Backdrop");
    if (!entry.logo_url) missing.push("Logo");
    if (!entry.overview) missing.push("Overview");
    if (!entry.genres || entry.genres.length === 0) missing.push("Genres");
    if (!entry.cast_data || entry.cast_data.length === 0) missing.push("Cast");
    return missing;
  };

  // Search DB entries with filters
  const handleSearchDb = async () => {
    setIsSearchingDb(true);
    setSearchResults([]);

    try {
      const isNumeric = /^\d+$/.test(searchQuery.trim());

      let query = supabase
        .from("entries")
        .select("id, type, title, content, poster_url, backdrop_url, logo_url, overview, tagline, status, genres, cast_data, release_year, admin_edited, media_updated_at, vote_average, runtime, number_of_seasons, number_of_episodes")
        .limit(50);

      if (isNumeric) {
        query = query.eq("id", searchQuery.trim());
      } else if (searchQuery.trim()) {
        query = query.ilike("title", `%${searchQuery.trim()}%`);
      }
      // If searchQuery is empty, we just fetch based on filters below

      // Apply type filter
      if (filterState.type !== "all") {
        query = query.eq("type", filterState.type);
      }

      // Apply missing filters
      if (filterState.missingPoster) query = query.is("poster_url", null);
      if (filterState.missingBackdrop) query = query.is("backdrop_url", null);
      if (filterState.missingLogo) query = query.is("logo_url", null);
      if (filterState.missingOverview) query = query.is("overview", null);

      // Apply recently edited filter
      if (filterState.recentlyEdited !== "all") {
        const now = new Date();
        let cutoff: Date;
        switch (filterState.recentlyEdited) {
          case "24h":
            cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "7d":
            cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "30d":
            cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            cutoff = new Date(0);
        }
        query = query.gte("media_updated_at", cutoff.toISOString());
      }

      // Apply sorting
      switch (filterState.sortBy) {
        case "recent":
          query = query.order("media_updated_at", { ascending: false, nullsFirst: false });
          break;
        case "year_desc":
          query = query.order("release_year", { ascending: false, nullsFirst: false });
          break;
        case "year_asc":
          query = query.order("release_year", { ascending: true, nullsFirst: false });
          break;
        case "name":
          query = query.order("title", { ascending: true });
          break;
        case "rating":
          query = query.order("vote_average", { ascending: false, nullsFirst: false });
          break;
        default:
          break;
      }

      const { data, error } = await query;

      if (error) throw error;

      // Helper to check if entry has links
      const checkHasLinks = (entry: any): boolean => {
        const content = entry.content;
        if (!content) return false;
        if (entry.type === "movie") {
          return !!(content.watch_link || content.download_link);
        } else {
          // Series: check if any season has links
          for (const key of Object.keys(content)) {
            if (key.startsWith("season_")) {
              const season = content[key];
              if (season?.watch_links?.length > 0 || season?.download_links?.length > 0) {
                return true;
              }
            }
          }
          return false;
        }
      };

      let results: SearchResult[] = (data || []).map((entry) => {
        const entryHasLinks = checkHasLinks(entry);
        return {
          id: entry.id,
          type: entry.type as "movie" | "series",
          title: entry.title || `ID: ${entry.id}`,
          posterUrl: entry.poster_url,
          year: entry.release_year?.toString() || "N/A",
          inDb: true,
          hasLinks: entryHasLinks,
          missingFields: calculateMissingFields(entry),
          adminEdited: entry.admin_edited || false,
          // Full metadata for DB entries
          backdropUrl: entry.backdrop_url,
          logoUrl: entry.logo_url,
          overview: entry.overview,
          tagline: entry.tagline,
          status: entry.status,
          voteAverage: entry.vote_average,
          runtime: entry.runtime,
          numberOfSeasons: entry.number_of_seasons,
          numberOfEpisodes: entry.number_of_episodes,
          genres: entry.genres,
          castData: entry.cast_data,
        };
      });

      // Filter by links
      if (filterState.linksFilter === "with_links") {
        results = results.filter((r) => r.hasLinks);
      } else if (filterState.linksFilter === "without_links") {
        results = results.filter((r) => !r.hasLinks);
      }

      // Filter by missing genres/cast client-side (JSONB is harder to query)
      if (filterState.missingGenres) {
        results = results.filter((r) => r.missingFields?.includes("Genres"));
      }
      if (filterState.missingCast) {
        results = results.filter((r) => r.missingFields?.includes("Cast"));
      }

      // Sort by missing count if selected
      if (filterState.sortBy === "missing") {
        results.sort((a, b) => (b.missingFields?.length || 0) - (a.missingFields?.length || 0));
      }

      setSearchResults(results);

      if (results.length === 0) {
        toast({
          title: "No Results",
          description: "No entries found matching your criteria.",
        });
      }
    } catch (error) {
      console.error("DB search error:", error);
      toast({
        title: "Error",
        description: "Failed to search database.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingDb(false);
    }
  };

  // Search TMDB (secondary)
  const handleSearchTmdb = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingTmdb(true);
    setSearchResults([]);

    try {
      const response = await searchMergedGlobal(searchQuery.trim());

      // Check which results exist in DB and get their link status
      const ids = response.results.map((r) => String(r.id));
      const { data: existingEntries } = await supabase
        .from("entries")
        .select("id, content, type")
        .in("id", ids);

      const existingMap = new Map<string, { hasLinks: boolean }>();
      (existingEntries || []).forEach((e) => {
        let entryHasLinks = false;
        const content = e.content as Record<string, any>;
        if (e.type === "movie") {
          entryHasLinks = !!(content?.watch_link || content?.download_link);
        } else {
          for (const key of Object.keys(content || {})) {
            if (key.startsWith("season_")) {
              const season = content[key];
              if (season?.watch_links?.length > 0 || season?.download_links?.length > 0) {
                entryHasLinks = true;
                break;
              }
            }
          }
        }
        existingMap.set(e.id, { hasLinks: entryHasLinks });
      });

      const results: SearchResult[] = response.results.slice(0, 20).map((item: Movie) => {
        const existing = existingMap.get(String(item.id));
        return {
          id: String(item.id),
          type: item.media_type === "tv" ? "series" : "movie",
          title: item.title || item.name || `ID: ${item.id}`,
          posterUrl: getImageUrl(item.poster_path, "w185"),
          year: (item.release_date || item.first_air_date)?.split("-")[0] || "N/A",
          inDb: !!existing,
          hasLinks: existing?.hasLinks || false,
        };
      });

      setTmdbResults(results);

      if (results.length === 0) {
        toast({
          title: "No Results",
          description: "No content found on TMDB.",
        });
      }
    } catch (error) {
      console.error("TMDB search error:", error);
      toast({
        title: "Error",
        description: "Failed to search TMDB.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingTmdb(false);
    }
  };

  // Load full entry data
  const handleSelectEntry = async (result: SearchResult) => {
    setIsLoadingEntry(true);
    setSelectedEntry(null);
    setEpisodes([]);

    try {
      // If result has full metadata from DB search (entries with links), use it directly
      if (result.inDb && result.hasLinks && result.backdropUrl !== undefined) {
        // Create entry from cached result data
        const entry: EntryData = {
          id: result.id,
          type: result.type,
          content: {}, // Content not needed for metadata editing
          title: result.title,
          poster_url: result.posterUrl,
          backdrop_url: result.backdropUrl,
          logo_url: result.logoUrl,
          overview: result.overview,
          tagline: result.tagline,
          status: result.status,
          vote_average: result.voteAverage ?? null,
          runtime: result.runtime,
          release_year: result.year ? parseInt(result.year, 10) : null,
          number_of_seasons: result.numberOfSeasons,
          number_of_episodes: result.numberOfEpisodes,
          genres: result.genres || [],
          cast_data: result.castData || [],
          admin_edited: result.adminEdited || false,
        };

        setSelectedEntry(entry);
        populateFormFromEntry(entry);

        // Load episodes if series
        if (entry.type === "series") {
          const allEpisodes = await fetchAllEpisodeMetadata(entry.id);
          setEpisodes(allEpisodes);

          // Set initial season from number_of_seasons
          if (entry.number_of_seasons && entry.number_of_seasons > 0) {
            setSelectedSeason(1);
          }
        }
      } else {
        // Standard DB fetch for full data
        const { data: dbEntry, error } = await supabase.from("entries").select("*").eq("id", result.id).maybeSingle();

        if (error) throw error;

        if (dbEntry) {
          // Entry exists in DB
          const entry = dbEntry as EntryData;
          setSelectedEntry(entry);
          populateFormFromEntry(entry);

          // Load episodes if series
          if (entry.type === "series") {
            const allEpisodes = await fetchAllEpisodeMetadata(entry.id);
            setEpisodes(allEpisodes);

            // Set initial season
            const content = entry.content as Record<string, any>;
            const seasons = Object.keys(content)
              .filter((k) => k.startsWith("season_"))
              .map((k) => parseInt(k.replace("season_", ""), 10))
              .filter((n) => !isNaN(n))
              .sort((a, b) => a - b);

            if (seasons.length > 0) {
              setSelectedSeason(seasons[0]);
            } else if (entry.number_of_seasons && entry.number_of_seasons > 0) {
              setSelectedSeason(1);
            }
          }
        } else {
          // Entry not in DB - fetch from TMDB and create stub
          await loadFromTmdb(result.id, result.type);
        }
      }
    } catch (error) {
      console.error("Error loading entry:", error);
      toast({
        title: "Error",
        description: "Failed to load entry data.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingEntry(false);
    }
  };

  // Populate form fields from entry
  const populateFormFromEntry = (entry: EntryData) => {
    setTitle(entry.title || "");
    setPosterUrl(entry.poster_url || "");
    setBackdropUrl(entry.backdrop_url || "");
    setLogoUrl(entry.logo_url || "");
    setOverview(entry.overview || "");
    setTagline(entry.tagline || "");
    setStatus(entry.status || "");
    setVoteAverage(entry.vote_average ?? null);
    setRuntime(entry.runtime ?? null);
    setReleaseYear(entry.release_year ?? null);
    setNumberOfSeasons(entry.number_of_seasons ?? null);
    setNumberOfEpisodes(entry.number_of_episodes ?? null);
    setGenres(entry.genres || []);
    setCastData(entry.cast_data || []);
    setAdminEdited(entry.admin_edited || false);
  };

  // Load fresh data from TMDB
  const loadFromTmdb = async (id: string, type: "movie" | "series") => {
    try {
      if (type === "movie") {
        const [details, images, credits] = await Promise.all([
          getMovieDetails(Number(id)),
          getMovieImages(Number(id)),
          getMovieCredits(Number(id)),
        ]);

        const logoPath =
          images.logos?.find((l) => l.iso_639_1 === "en")?.file_path ||
          images.logos?.find((l) => l.iso_639_1 == null)?.file_path ||
          images.logos?.[0]?.file_path;

        const topCast =
          credits.cast?.slice(0, 12).map((c) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profile_path: c.profile_path,
          })) || [];

        const entry: EntryData = {
          id,
          type: "movie",
          content: { watch_link: "", download_link: "" },
          title: details.title,
          poster_url: getImageUrl(details.poster_path, "w342"),
          backdrop_url: getImageUrl(details.backdrop_path, "original"),
          logo_url: logoPath ? getImageUrl(logoPath, "w500") : null,
          overview: details.overview,
          tagline: details.tagline,
          status: details.status,
          vote_average: details.vote_average,
          runtime: details.runtime,
          release_year: details.release_date ? parseInt(details.release_date.split("-")[0], 10) : null,
          genres: details.genres,
          cast_data: topCast,
          admin_edited: false,
        };

        setSelectedEntry(entry);
        populateFormFromEntry(entry);
      } else {
        const [details, images, credits] = await Promise.all([
          getTVDetails(Number(id)),
          getTVImages(Number(id)),
          getTVCredits(Number(id)),
        ]);

        const logoPath =
          images.logos?.find((l) => l.iso_639_1 === "en")?.file_path ||
          images.logos?.find((l) => l.iso_639_1 == null)?.file_path ||
          images.logos?.[0]?.file_path;

        const topCast =
          credits.cast?.slice(0, 12).map((c) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profile_path: c.profile_path,
          })) || [];

        const entry: EntryData = {
          id,
          type: "series",
          content: {},
          title: details.name,
          poster_url: getImageUrl(details.poster_path, "w342"),
          backdrop_url: getImageUrl(details.backdrop_path, "original"),
          logo_url: logoPath ? getImageUrl(logoPath, "w500") : null,
          overview: details.overview,
          tagline: details.tagline,
          status: details.status,
          vote_average: details.vote_average,
          number_of_seasons: details.number_of_seasons,
          number_of_episodes: details.number_of_episodes,
          release_year: details.first_air_date ? parseInt(details.first_air_date.split("-")[0], 10) : null,
          genres: details.genres,
          cast_data: topCast,
          admin_edited: false,
        };

        setSelectedEntry(entry);
        populateFormFromEntry(entry);

        if (details.number_of_seasons) {
          setSelectedSeason(1);
        }
      }
    } catch (error) {
      console.error("Error loading from TMDB:", error);
      throw error;
    }
  };

  // Toggle Season Expansion
  const toggleSeasonExpansion = (seasonNum: number) => {
    setExpandedSeasons(prev =>
      prev.includes(seasonNum) ? prev.filter(s => s !== seasonNum) : [...prev, seasonNum]
    );
  };

  // Sync entry metadata from TMDB (clears admin_edited)
  const handleSyncFromTmdb = async () => {
    if (!selectedEntry) return;
    setIsSyncing(true);

    try {
      await loadFromTmdb(selectedEntry.id, selectedEntry.type);
      setAdminEdited(false); // Clear admin_edited on sync
      toast({
        title: "Synced",
        description: "Metadata refreshed from TMDB. Click Save to persist.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sync from TMDB.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync a single season's episodes from TMDB
  const handleSyncSeason = async (seasonNum: number) => {
    if (!selectedEntry || selectedEntry.type !== "series") return;
    setIsSyncing(true);

    try {
      const seasonDetails = await getTVSeasonDetails(Number(selectedEntry.id), seasonNum);

      const newEpisodes: SaveEpisodeInput[] = seasonDetails.episodes.map((ep) => ({
        episode_number: ep.episode_number,
        name: ep.name || null,
        overview: ep.overview || null,
        still_path: ep.still_path ? getImageUrl(ep.still_path, "w300") : null,
        air_date: ep.air_date || null,
        runtime: ep.runtime || null,
        vote_average: ep.vote_average ?? null,
        admin_edited: false,
      }));

      await saveEpisodeMetadata(selectedEntry.id, seasonNum, newEpisodes);

      // Reload episodes
      const allEpisodes = await fetchAllEpisodeMetadata(selectedEntry.id);
      setEpisodes(allEpisodes);

      toast({
        title: "Season Synced",
        description: `Season ${seasonNum} (${newEpisodes.length} episodes) synced from TMDB.`,
      });
    } catch (error) {
      console.error("Error syncing season:", error);
      toast({
        title: "Error",
        description: "Failed to sync season from TMDB.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync all seasons from TMDB
  const handleSyncAllSeasons = async () => {
    if (!selectedEntry || selectedEntry.type !== "series") return;
    setIsSyncing(true);

    const totalSeasons = numberOfSeasons || selectedEntry.number_of_seasons || 1;

    try {
      for (let seasonNum = 1; seasonNum <= totalSeasons; seasonNum++) {
        setSyncProgress({
          current: seasonNum,
          total: totalSeasons,
          message: `Syncing Season ${seasonNum} of ${totalSeasons}...`,
        });

        try {
          const seasonDetails = await getTVSeasonDetails(Number(selectedEntry.id), seasonNum);

          const newEpisodes: SaveEpisodeInput[] = seasonDetails.episodes.map((ep) => ({
            episode_number: ep.episode_number,
            name: ep.name || null,
            overview: ep.overview || null,
            still_path: ep.still_path ? getImageUrl(ep.still_path, "w300") : null,
            air_date: ep.air_date || null,
            runtime: ep.runtime || null,
            vote_average: ep.vote_average ?? null,
            admin_edited: false,
          }));

          await saveEpisodeMetadata(selectedEntry.id, seasonNum, newEpisodes);
        } catch (err) {
          console.warn(`Failed to sync season ${seasonNum}:`, err);
        }

        // Rate limiting
        await new Promise((r) => setTimeout(r, 300));
      }

      // Reload all episodes
      const allEpisodes = await fetchAllEpisodeMetadata(selectedEntry.id);
      setEpisodes(allEpisodes);

      toast({
        title: "All Seasons Synced",
        description: `Synced ${totalSeasons} seasons from TMDB.`,
      });
    } catch (error) {
      console.error("Error syncing all seasons:", error);
      toast({
        title: "Error",
        description: "Failed to sync all seasons.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Save entry metadata to DB (auto-sets admin_edited = true)
  const handleSave = async () => {
    if (!selectedEntry) return;
    setIsSaving(true);

    try {
      const updateData = {
        title: title || null,
        poster_url: posterUrl || null,
        backdrop_url: backdropUrl || null,
        logo_url: logoUrl || null,
        overview: overview || null,
        tagline: tagline || null,
        status: status || null,
        vote_average: voteAverage,
        runtime: runtime,
        release_year: releaseYear,
        number_of_seasons: numberOfSeasons,
        number_of_episodes: numberOfEpisodes,
        genres: genres.length > 0 ? genres : null,
        cast_data: castData.length > 0 ? castData : null,
        admin_edited: true, // Auto-set on save
        media_updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("entries").upsert({
        id: selectedEntry.id,
        type: selectedEntry.type,
        ...updateData
      });

      if (error) throw error;

      setAdminEdited(true);

      toast({
        title: "Saved",
        description: "Entry metadata saved successfully.",
      });
    } catch (error: any) {
      console.error("Error saving entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save entry.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update episode field
  const updateEpisodeField = (seasonNum: number, epNum: number, field: keyof EpisodeMetadata, value: any) => {
    setEpisodes((prev) =>
      prev.map((ep) => (ep.season_number === seasonNum && ep.episode_number === epNum ? { ...ep, [field]: value } : ep))
    );
  };

  // Save single episode
  const handleSaveEpisode = async (ep: EpisodeMetadata) => {
    if (!selectedEntry) return;

    const result = await saveSingleEpisode(selectedEntry.id, ep.season_number, {
      episode_number: ep.episode_number,
      name: ep.name,
      overview: ep.overview,
      still_path: ep.still_path,
      air_date: ep.air_date,
      runtime: ep.runtime,
      vote_average: ep.vote_average,
      admin_edited: true, // Auto-set on save
    });

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error || "Failed to save episode.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Saved",
        description: `Episode ${ep.episode_number} saved.`,
      });
    }
  };

  // Sync single episode from TMDB
  const handleSyncSingleEpisode = async (ep: EpisodeMetadata) => {
    if (!selectedEntry) return;

    try {
      const seasonDetails = await getTVSeasonDetails(Number(selectedEntry.id), ep.season_number);
      const tmdbEp = seasonDetails.episodes.find((e) => e.episode_number === ep.episode_number);

      if (!tmdbEp) {
        toast({
          title: "Not Found",
          description: "Episode not found on TMDB.",
          variant: "destructive",
        });
        return;
      }

      updateEpisodeField(ep.season_number, ep.episode_number, "name", tmdbEp.name || null);
      updateEpisodeField(ep.season_number, ep.episode_number, "overview", tmdbEp.overview || null);
      updateEpisodeField(
        ep.season_number,
        ep.episode_number,
        "still_path",
        tmdbEp.still_path ? getImageUrl(tmdbEp.still_path, "w300") : null
      );
      updateEpisodeField(ep.season_number, ep.episode_number, "air_date", tmdbEp.air_date || null);
      updateEpisodeField(ep.season_number, ep.episode_number, "runtime", tmdbEp.runtime || null);
      updateEpisodeField(ep.season_number, ep.episode_number, "vote_average", tmdbEp.vote_average ?? null);
      updateEpisodeField(ep.season_number, ep.episode_number, "admin_edited", false);

      toast({
        title: "Episode Synced",
        description: `Episode ${ep.episode_number} data refreshed. Click save to persist.`,
      });
    } catch (error) {
      console.error("Error syncing episode:", error);
      toast({
        title: "Error",
        description: "Failed to sync episode.",
        variant: "destructive",
      });
    }
  };

  // Add new season
  const handleAddSeason = async () => {
    if (!selectedEntry || selectedEntry.type !== "series") return;

    // Create empty episode for the new season
    const newEpisode: EpisodeMetadata = {
      entry_id: selectedEntry.id,
      season_number: newSeasonNumber,
      episode_number: 1,
      name: "Episode 1",
      overview: null,
      still_path: null,
      air_date: null,
      runtime: null,
      vote_average: null,
      admin_edited: true,
    };

    setEpisodes((prev) => [...prev, newEpisode]);
    setSelectedSeason(newSeasonNumber);
    setShowAddSeasonDialog(false);

    // Update number_of_seasons if needed
    if (!numberOfSeasons || newSeasonNumber > numberOfSeasons) {
      setNumberOfSeasons(newSeasonNumber);
    }

    toast({
      title: "Season Added",
      description: `Season ${newSeasonNumber} created. Don't forget to save.`,
    });
  };

  // Delete season
  const handleDeleteSeason = async () => {
    if (!selectedEntry || selectedEntry.type !== "series") return;

    // Remove episodes for this season from local state
    setEpisodes((prev) => prev.filter((ep) => ep.season_number !== selectedSeason));

    // Delete from database
    try {
      await supabase
        .from("entry_metadata")
        .delete()
        .eq("entry_id", selectedEntry.id)
        .eq("season_number", selectedSeason);
    } catch (e) {
      console.warn("Failed to delete season from DB:", e);
    }

    // Select another season
    const remaining = availableSeasons.filter((s) => s !== selectedSeason);
    if (remaining.length > 0) {
      setSelectedSeason(remaining[0]);
    }

    setShowDeleteSeasonConfirm(false);

    toast({
      title: "Season Deleted",
      description: `Season ${selectedSeason} removed.`,
    });
  };

  // Add new episode
  const handleAddEpisode = async () => {
    if (!selectedEntry || selectedEntry.type !== "series") return;

    const newEpisode: EpisodeMetadata = {
      entry_id: selectedEntry.id,
      season_number: selectedSeason,
      episode_number: newEpisodeNumber,
      name: `Episode ${newEpisodeNumber}`,
      overview: null,
      still_path: null,
      air_date: null,
      runtime: null,
      vote_average: null,
      admin_edited: true,
    };

    setEpisodes((prev) => [...prev, newEpisode].sort((a, b) => a.episode_number - b.episode_number));
    setShowAddEpisodeDialog(false);

    toast({
      title: "Episode Added",
      description: `Episode ${newEpisodeNumber} created. Don't forget to save.`,
    });
  };

  // Delete episode
  const handleDeleteEpisode = async (ep: EpisodeMetadata) => {
    if (!selectedEntry) return;

    setEpisodes((prev) =>
      prev.filter((e) => !(e.season_number === ep.season_number && e.episode_number === ep.episode_number))
    );

    // Delete from database
    try {
      await supabase
        .from("entry_metadata")
        .delete()
        .eq("entry_id", selectedEntry.id)
        .eq("season_number", ep.season_number)
        .eq("episode_number", ep.episode_number);
    } catch (e) {
      console.warn("Failed to delete episode from DB:", e);
    }

    setShowDeleteEpisodeConfirm(null);

    toast({
      title: "Episode Deleted",
      description: `Episode ${ep.episode_number} removed.`,
    });
  };

  // Remove genre
  const handleRemoveGenre = (id: number) => {
    setGenres(genres.filter((g) => g.id !== id));
  };

  // Remove cast member
  const handleRemoveCast = (id: number) => {
    setCastData(castData.filter((c) => c.id !== id));
  };

  // Open genre modal
  const openGenreModal = () => {
    setTempSelectedGenres([...genres]);
    setGenreSearch("");
    setNewCustomGenre("");
    setShowGenreModal(true);
  };

  // Toggle genre in temp selection
  const toggleGenre = (genre: Genre) => {
    const exists = tempSelectedGenres.some((g) => g.id === genre.id);
    if (exists) {
      setTempSelectedGenres(tempSelectedGenres.filter((g) => g.id !== genre.id));
    } else {
      setTempSelectedGenres([...tempSelectedGenres, genre]);
    }
  };

  // Add custom genre
  const handleAddCustomGenre = () => {
    if (!newCustomGenre.trim()) return;
    const customGenre: Genre = {
      id: Date.now(),
      name: newCustomGenre.trim(),
    };
    setTempSelectedGenres([...tempSelectedGenres, customGenre]);
    setNewCustomGenre("");
  };

  // Apply genre selection
  const applyGenreSelection = () => {
    setGenres(tempSelectedGenres);
    setShowGenreModal(false);
  };

  // Filter genres by search
  const filteredGenres = useMemo(() => {
    if (!genreSearch.trim()) return TMDB_GENRES;
    return TMDB_GENRES.filter((g) => g.name.toLowerCase().includes(genreSearch.toLowerCase()));
  }, [genreSearch]);

  // Get episodes for selected season
  const seasonEpisodes = episodes.filter((ep) => ep.season_number === selectedSeason).sort((a, b) => a.episode_number - b.episode_number);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedEntry(null);
    setEpisodes([]);
    setTitle("");
    setPosterUrl("");
    setBackdropUrl("");
    setLogoUrl("");
    setOverview("");
    setTagline("");
    setStatus("");
    setVoteAverage(null);
    setRuntime(null);
    setReleaseYear(null);
    setNumberOfSeasons(null);
    setNumberOfEpisodes(null);
    setGenres([]);
    setCastData([]);
    setAdminEdited(false);
    setSelectedSeason(1);
    setExpandedEpisode(null);
  }, []);

  return (
    <Card className="bg-black/40 backdrop-blur-md border-white/10 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Pencil className="w-5 h-5 text-primary" />
          Post Metadata Editor
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Search and edit metadata for any entry, or import new items from TMDB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Section */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by title or TMDB ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchDb()}
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button onClick={handleSearchDb} disabled={isSearchingDb} className="flex-1 md:flex-initial gap-1 bg-cinema-red hover:bg-cinema-red/90 text-white shadow-lg shadow-cinema-red/20">
                {isSearchingDb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Search DB
              </Button>
              <Button onClick={handleSearchTmdb} disabled={isSearchingTmdb || !searchQuery.trim()} variant="outline" className="flex-1 md:flex-initial gap-1">
                {isSearchingTmdb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                Search TMDB
              </Button>
              <Button variant="outline" onClick={handleClearSelection} className="flex-1 md:flex-initial gap-1 border-primary/30 hover:bg-primary/10">
                <Plus className="w-4 h-4" />
                Add New
              </Button>
            </div>
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1">
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            {isSearchingDb && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="border rounded-md p-4 space-y-4 bg-muted/30">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={filterState.type} onValueChange={(v) => setFilterState((s) => ({ ...s, type: v as FilterType }))}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="movie">Movies</SelectItem>
                      <SelectItem value="series">Series</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Links</Label>
                  <Select value={filterState.linksFilter} onValueChange={(v) => setFilterState((s) => ({ ...s, linksFilter: v as LinksFilter }))}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="with_links">With Links</SelectItem>
                      <SelectItem value="without_links">Without Links</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sort By</Label>
                  <Select value={filterState.sortBy} onValueChange={(v) => setFilterState((s) => ({ ...s, sortBy: v as SortBy }))}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Recently Edited</SelectItem>
                      <SelectItem value="year_desc">Year (Newest)</SelectItem>
                      <SelectItem value="year_asc">Year (Oldest)</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="rating">Rating (Highest)</SelectItem>
                      <SelectItem value="missing">Missing Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Edited Period</Label>
                  <Select
                    value={filterState.recentlyEdited}
                    onValueChange={(v) => setFilterState((s) => ({ ...s, recentlyEdited: v as RecentlyEditedFilter }))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Missing Fields</Label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterState.missingPoster}
                      onCheckedChange={(c) => setFilterState((s) => ({ ...s, missingPoster: !!c }))}
                    />
                    Poster
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterState.missingBackdrop}
                      onCheckedChange={(c) => setFilterState((s) => ({ ...s, missingBackdrop: !!c }))}
                    />
                    Backdrop
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterState.missingLogo}
                      onCheckedChange={(c) => setFilterState((s) => ({ ...s, missingLogo: !!c }))}
                    />
                    Logo
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterState.missingOverview}
                      onCheckedChange={(c) => setFilterState((s) => ({ ...s, missingOverview: !!c }))}
                    />
                    Overview
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterState.missingGenres}
                      onCheckedChange={(c) => setFilterState((s) => ({ ...s, missingGenres: !!c }))}
                    />
                    Genres
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterState.missingCast}
                      onCheckedChange={(c) => setFilterState((s) => ({ ...s, missingCast: !!c }))}
                    />
                    Cast
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Database Results Section */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <h4 className="font-medium text-sm">Database Results ({searchResults.length})</h4>
              </div>
              <ScrollArea className="h-48 border rounded-md p-2">
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={`db-${result.id}-${result.type}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary cursor-pointer transition-colors"
                      onClick={() => handleSelectEntry(result)}
                    >
                      {result.posterUrl ? (
                        <img src={result.posterUrl} alt={result.title} className="w-10 h-14 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                          {result.type === "movie" ? (
                            <Film className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Tv className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.title}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {result.type === "movie" ? "Movie" : "Series"}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {result.year}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            ID: {result.id}
                          </Badge>
                          {result.hasLinks && <Badge className="text-xs bg-emerald-600">Has Links</Badge>}
                          {result.adminEdited && <Badge className="text-xs bg-amber-600">Admin Edited</Badge>}
                          {result.missingFields && result.missingFields.length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              Missing: {result.missingFields.join(", ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* TMDB Results Section (Separate) */}
          {tmdbResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                <h4 className="font-medium text-sm">TMDB Results ({tmdbResults.length})</h4>
              </div>
              <ScrollArea className="h-48 border rounded-md p-2 border-blue-500/30">
                <div className="space-y-2">
                  {tmdbResults.map((result) => (
                    <div
                      key={`tmdb-${result.id}-${result.type}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary cursor-pointer transition-colors"
                      onClick={() => handleSelectEntry(result)}
                    >
                      {result.posterUrl ? (
                        <img src={result.posterUrl} alt={result.title} className="w-10 h-14 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                          {result.type === "movie" ? (
                            <Film className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Tv className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.title}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {result.type === "movie" ? "Movie" : "Series"}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {result.year}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            ID: {result.id}
                          </Badge>
                          {result.inDb ? (
                            <>
                              <Badge className="text-xs bg-green-600">In DB</Badge>
                              {result.hasLinks && <Badge className="text-xs bg-emerald-600">Has Links</Badge>}
                            </>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Not in DB</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoadingEntry && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading entry data...</span>
          </div>
        )}

        {/* Selected Entry Editor */}
        {selectedEntry && !isLoadingEntry && (
          <div className="space-y-6 border-t pt-6">
            {/* Header with actions */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                {posterUrl && <img src={posterUrl} alt={title} className="w-16 h-24 object-cover rounded" />}
                <div>
                  <h3 className="font-semibold text-lg">{title || `ID: ${selectedEntry.id}`}</h3>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge variant="outline">{selectedEntry.type === "movie" ? "Movie" : "Series"}</Badge>
                    <Badge variant="secondary">ID: {selectedEntry.id}</Badge>
                    {adminEdited && <Badge className="bg-amber-600">Admin Edited</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleClearSelection}>
                  <X className="w-4 h-4 mr-1" /> Close
                </Button>
                <Button variant="outline" size="sm" onClick={handleSyncFromTmdb} disabled={isSyncing}>
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Sync from TMDB
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-cinema-red hover:bg-cinema-red/90 text-white shadow-lg shadow-cinema-red/20">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save Changes
                </Button>
              </div>
            </div>

            {/* Sync Progress */}
            {syncProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{syncProgress.message}</span>
                  <span>
                    {syncProgress.current}/{syncProgress.total}
                  </span>
                </div>
                <Progress value={(syncProgress.current / syncProgress.total) * 100} />
              </div>
            )}

            {/* Main Metadata Collapsible Card */}
            <Collapsible open={isMainMetadataOpen} onOpenChange={setIsMainMetadataOpen} className="border rounded-md bg-card">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsMainMetadataOpen(!isMainMetadataOpen)}>
                <div className="flex items-center gap-2 font-semibold">
                  <Pencil className="w-5 h-5" />
                  Main Metadata
                  {!isMainMetadataOpen && <span className="text-sm font-normal text-muted-foreground ml-2">Click to expand</span>}
                </div>
                {isMainMetadataOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              <CollapsibleContent className="p-4 pt-0 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        value={releaseYear ?? ""}
                        onChange={(e) => setReleaseYear(e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Input id="status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Released" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rating">Rating</Label>
                      <Input
                        id="rating"
                        type="number"
                        step="0.1"
                        value={voteAverage ?? ""}
                        onChange={(e) => setVoteAverage(e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                  </div>
                </div>

                {/* Series-specific fields */}
                {selectedEntry.type === "series" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="seasons">Seasons</Label>
                      <Input
                        id="seasons"
                        type="number"
                        value={numberOfSeasons ?? ""}
                        onChange={(e) => setNumberOfSeasons(e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="episodes">Total Episodes</Label>
                      <Input
                        id="episodes"
                        type="number"
                        value={numberOfEpisodes ?? ""}
                        onChange={(e) => setNumberOfEpisodes(e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                  </div>
                )}

                {/* Movie-specific fields */}
                {selectedEntry.type === "movie" && (
                  <div className="space-y-2">
                    <Label htmlFor="runtime">Runtime (minutes)</Label>
                    <Input
                      id="runtime"
                      type="number"
                      value={runtime ?? ""}
                      onChange={(e) => setRuntime(e.target.value ? Number(e.target.value) : null)}
                      className="w-32"
                    />
                  </div>
                )}

                {/* Image URLs */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Images
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="poster">Poster URL</Label>
                      <Input id="poster" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="https://..." />
                      {posterUrl && <img src={posterUrl} alt="Poster" className="w-20 h-30 object-cover rounded mt-1" />}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="backdrop">Backdrop URL</Label>
                      <Input id="backdrop" value={backdropUrl} onChange={(e) => setBackdropUrl(e.target.value)} placeholder="https://..." />
                      {backdropUrl && <img src={backdropUrl} alt="Backdrop" className="w-32 h-18 object-cover rounded mt-1" />}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logo">Logo URL</Label>
                      <Input id="logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
                      {logoUrl && <img src={logoUrl} alt="Logo" className="w-24 h-12 object-contain rounded mt-1 bg-black/50 p-1" />}
                    </div>
                  </div>
                </div>

                {/* Overview & Tagline */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="overview">Overview</Label>
                    <Textarea id="overview" value={overview} onChange={(e) => setOverview(e.target.value)} rows={4} placeholder="Enter overview..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Enter tagline..." />
                  </div>
                </div>

                {/* Genres */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Genres</Label>
                    <Button variant="outline" size="sm" onClick={openGenreModal} className="gap-1">
                      <Pencil className="w-3 h-3" /> Edit Genres
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {genres.length === 0 ? (
                      <span className="text-muted-foreground text-sm">No genres selected</span>
                    ) : (
                      genres.map((genre) => (
                        <Badge key={genre.id} variant="secondary" className="gap-1">
                          {genre.name}
                          <button onClick={() => handleRemoveGenre(genre.id)} className="ml-1 hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                {/* Cast */}
                <div className="space-y-2">
                  <Label>Cast (Top 12)</Label>
                  <div className="flex flex-wrap gap-2">
                    {castData.length === 0 ? (
                      <span className="text-muted-foreground text-sm">No cast data</span>
                    ) : (
                      castData.map((member) => (
                        <Badge key={member.id} variant="outline" className="gap-1">
                          {member.name}
                          {member.character && <span className="text-muted-foreground">as {member.character}</span>}
                          <button onClick={() => handleRemoveCast(member.id)} className="ml-1 hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Episode Metadata Section (Series Only) */}
            {selectedEntry.type === "series" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Tv className="w-5 h-5" />
                    Seasons & Episodes
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextSeason = Math.max(...availableSeasons, 0) + 1;
                        setNewSeasonNumber(nextSeason);
                        setShowAddSeasonDialog(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Season
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSyncAllSeasons} disabled={isSyncing}>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Sync All Seasons
                    </Button>
                  </div>
                </div>

                {availableSeasons.map(seasonNum => {
                  const seasonEps = episodes.filter(ep => ep.season_number === seasonNum).sort((a, b) => a.episode_number - b.episode_number);
                  const isExpanded = expandedSeasons.includes(seasonNum);

                  return (
                    <Collapsible
                      key={seasonNum}
                      open={isExpanded}
                      onOpenChange={() => toggleSeasonExpansion(seasonNum)}
                      className="border rounded-md bg-card"
                    >
                      <div className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-4 flex-1">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            <h4 className="font-medium text-base">Season {seasonNum}</h4>
                            <Badge variant="secondary" className="text-xs">{seasonEps.length} Episodes</Badge>
                          </div>
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => handleSyncSeason(seasonNum)} disabled={isSyncing} title="Sync Season">
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary"
                            onClick={() => {
                              setSelectedSeason(seasonNum);
                              const maxEp = seasonEps.length > 0 ? Math.max(...seasonEps.map((e) => e.episode_number)) : 0;
                              setNewEpisodeNumber(maxEp + 1);
                              setShowAddEpisodeDialog(true);
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedSeason(seasonNum);
                              setShowDeleteSeasonConfirm(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <CollapsibleContent className="p-4 pt-0 border-t">
                        {seasonEps.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground text-sm">
                            No episodes. Sync from TMDB or add manually.
                          </div>
                        ) : (
                          <div className="space-y-2 mt-4">
                            {seasonEps.map((ep) => (
                              <Collapsible
                                key={ep.episode_number}
                                open={expandedEpisode === ep.episode_number && selectedSeason === seasonNum} // Keep existing logic or adapt unique ID
                                onOpenChange={(open) => {
                                  if (open) {
                                    setSelectedSeason(seasonNum);
                                    setExpandedEpisode(ep.episode_number);
                                  } else {
                                    setExpandedEpisode(null);
                                  }
                                }}
                              >
                                <div className="border rounded-md">
                                  <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors">
                                    {ep.still_path ? (
                                      <img src={ep.still_path} alt={ep.name || `Episode ${ep.episode_number}`} className="w-16 h-9 object-cover rounded" />
                                    ) : (
                                      <div className="w-16 h-9 bg-muted rounded flex items-center justify-center">
                                        <Film className="w-4 h-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="flex-1 text-left">
                                      <p className="font-medium">
                                        E{ep.episode_number}: {ep.name || "Untitled"}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate max-w-md">{ep.overview || "No description"}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {ep.admin_edited && (
                                        <Badge variant="secondary" className="text-xs">
                                          Edited
                                        </Badge>
                                      )}
                                      {expandedEpisode === ep.episode_number ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="p-3 border-t space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Episode Number</Label>
                                        <Input
                                          type="number"
                                          value={ep.episode_number}
                                          onChange={(e) =>
                                            updateEpisodeField(ep.season_number, ep.episode_number, "episode_number", Number(e.target.value))
                                          }
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Name</Label>
                                        <Input
                                          value={ep.name || ""}
                                          onChange={(e) => updateEpisodeField(ep.season_number, ep.episode_number, "name", e.target.value || null)}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Air Date</Label>
                                        <Input
                                          value={ep.air_date || ""}
                                          onChange={(e) => updateEpisodeField(ep.season_number, ep.episode_number, "air_date", e.target.value || null)}
                                          className="h-8 text-sm"
                                          placeholder="YYYY-MM-DD"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Runtime (min)</Label>
                                        <Input
                                          type="number"
                                          value={ep.runtime ?? ""}
                                          onChange={(e) =>
                                            updateEpisodeField(ep.season_number, ep.episode_number, "runtime", e.target.value ? Number(e.target.value) : null)
                                          }
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Thumbnail URL</Label>
                                      <Input
                                        value={ep.still_path || ""}
                                        onChange={(e) => updateEpisodeField(ep.season_number, ep.episode_number, "still_path", e.target.value || null)}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Overview</Label>
                                      <Textarea
                                        value={ep.overview || ""}
                                        onChange={(e) => updateEpisodeField(ep.season_number, ep.episode_number, "overview", e.target.value || null)}
                                        rows={2}
                                        className="text-sm"
                                      />
                                    </div>
                                    <div className="flex gap-2 pt-2 flex-wrap">
                                      <Button size="sm" variant="outline" onClick={() => handleSyncSingleEpisode(ep)}>
                                        <RefreshCw className="w-3 h-3 mr-1" />
                                        Sync from TMDB
                                      </Button>
                                      <Button size="sm" onClick={() => handleSaveEpisode(ep)}>
                                        <Save className="w-3 h-3 mr-1" />
                                        Save Episode
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => setShowDeleteEpisodeConfirm(ep)}>
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        Delete
                                      </Button>
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            ))}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Genre Selection Modal */}
        <Dialog open={showGenreModal} onOpenChange={setShowGenreModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Select Genres</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Search genres..." value={genreSearch} onChange={(e) => setGenreSearch(e.target.value)} />
              <ScrollArea className="h-64 border rounded-md p-2">
                <div className="grid grid-cols-2 gap-2">
                  {filteredGenres.map((genre) => {
                    const isSelected = tempSelectedGenres.some((g) => g.id === genre.id);
                    return (
                      <label
                        key={genre.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isSelected ? "bg-primary/20" : "hover:bg-secondary"
                          }`}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleGenre(genre)} />
                        <span className="text-sm">{genre.name}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom genre..."
                  value={newCustomGenre}
                  onChange={(e) => setNewCustomGenre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustomGenre()}
                />
                <Button variant="outline" onClick={handleAddCustomGenre}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Selected: {tempSelectedGenres.map((g) => g.name).join(", ") || "None"}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGenreModal(false)}>
                Cancel
              </Button>
              <Button onClick={applyGenreSelection}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Season Dialog */}
        <Dialog open={showAddSeasonDialog} onOpenChange={setShowAddSeasonDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Season</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Season Number</Label>
                <Input type="number" value={newSeasonNumber} onChange={(e) => setNewSeasonNumber(Number(e.target.value))} min={1} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSeasonDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSeason}>Add Season</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Season Confirmation */}
        <AlertDialog open={showDeleteSeasonConfirm} onOpenChange={setShowDeleteSeasonConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Season {selectedSeason}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all episodes for Season {selectedSeason}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSeason} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Episode Dialog */}
        <Dialog open={showAddEpisodeDialog} onOpenChange={setShowAddEpisodeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Episode to Season {selectedSeason}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Episode Number</Label>
                <Input type="number" value={newEpisodeNumber} onChange={(e) => setNewEpisodeNumber(Number(e.target.value))} min={1} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddEpisodeDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEpisode}>Add Episode</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Episode Confirmation */}
        <AlertDialog open={!!showDeleteEpisodeConfirm} onOpenChange={() => setShowDeleteEpisodeConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Episode {showDeleteEpisodeConfirm?.episode_number}?</AlertDialogTitle>
              <AlertDialogDescription>This will remove the episode metadata. This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => showDeleteEpisodeConfirm && handleDeleteEpisode(showDeleteEpisodeConfirm)}
                className="bg-destructive text-destructive-foreground"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card >
  );
}
