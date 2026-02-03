import { useCallback, useState } from "react";
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
  Edit3,
  Image as ImageIcon,
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

interface SearchResult {
  id: string;
  type: "movie" | "series";
  title: string;
  posterUrl: string | null;
  year: string;
  inDb: boolean;
}

export function PostMetadataEditor() {
  const { toast } = useToast();
  const { fetchAllEpisodeMetadata, saveEpisodeMetadata, saveSingleEpisode } = useEntryMetadata();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);

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

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // New genre input
  const [newGenreName, setNewGenreName] = useState("");

  // Get available seasons from entry content
  const getAvailableSeasons = (): number[] => {
    if (!selectedEntry || selectedEntry.type !== "series") return [];
    const content = selectedEntry.content as Record<string, any>;
    const seasons = Object.keys(content)
      .filter((k) => k.startsWith("season_"))
      .map((k) => parseInt(k.replace("season_", ""), 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    
    // Also include seasons from number_of_seasons if higher
    if (selectedEntry.number_of_seasons) {
      for (let i = 1; i <= selectedEntry.number_of_seasons; i++) {
        if (!seasons.includes(i)) seasons.push(i);
      }
      seasons.sort((a, b) => a - b);
    }
    
    return seasons.length > 0 ? seasons : [1];
  };

  // Search DB entries
  const handleSearchDb = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingDb(true);
    setSearchResults([]);

    try {
      // Try exact ID match first
      const isNumeric = /^\d+$/.test(searchQuery.trim());
      
      let query = supabase
        .from("entries")
        .select("id, type, title, poster_url, release_year, admin_edited")
        .limit(20);

      if (isNumeric) {
        query = query.eq("id", searchQuery.trim());
      } else {
        query = query.ilike("title", `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const results: SearchResult[] = (data || []).map((entry) => ({
        id: entry.id,
        type: entry.type as "movie" | "series",
        title: entry.title || `ID: ${entry.id}`,
        posterUrl: entry.poster_url,
        year: entry.release_year?.toString() || "N/A",
        inDb: true,
      }));

      setSearchResults(results);

      if (results.length === 0) {
        toast({
          title: "No Results",
          description: "No entries found in the database.",
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

  // Search TMDB
  const handleSearchTmdb = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingTmdb(true);
    setSearchResults([]);

    try {
      const response = await searchMergedGlobal(searchQuery.trim());

      // Check which results exist in DB
      const ids = response.results.map((r) => String(r.id));
      const { data: existingEntries } = await supabase
        .from("entries")
        .select("id")
        .in("id", ids);

      const existingIds = new Set((existingEntries || []).map((e) => e.id));

      const results: SearchResult[] = response.results.slice(0, 20).map((item: Movie) => ({
        id: String(item.id),
        type: item.media_type === "tv" ? "series" : "movie",
        title: item.title || item.name || `ID: ${item.id}`,
        posterUrl: getImageUrl(item.poster_path, "w185"),
        year: (item.release_date || item.first_air_date)?.split("-")[0] || "N/A",
        inDb: existingIds.has(String(item.id)),
      }));

      setSearchResults(results);

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
      // Try loading from DB first
      const { data: dbEntry, error } = await supabase
        .from("entries")
        .select("*")
        .eq("id", result.id)
        .maybeSingle();

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
          const seasons = getAvailableSeasonsFromEntry(entry);
          if (seasons.length > 0) {
            setSelectedSeason(seasons[0]);
          }
        }
      } else {
        // Entry not in DB - fetch from TMDB and create stub
        await loadFromTmdb(result.id, result.type);
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

  const getAvailableSeasonsFromEntry = (entry: EntryData): number[] => {
    if (entry.type !== "series") return [];
    const content = entry.content as Record<string, any>;
    const seasons = Object.keys(content)
      .filter((k) => k.startsWith("season_"))
      .map((k) => parseInt(k.replace("season_", ""), 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    
    if (entry.number_of_seasons) {
      for (let i = 1; i <= entry.number_of_seasons; i++) {
        if (!seasons.includes(i)) seasons.push(i);
      }
      seasons.sort((a, b) => a - b);
    }
    
    return seasons.length > 0 ? seasons : [1];
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

        const topCast = credits.cast?.slice(0, 12).map((c) => ({
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

        const topCast = credits.cast?.slice(0, 12).map((c) => ({
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

  // Sync entry metadata from TMDB (override admin_edited)
  const handleSyncFromTmdb = async () => {
    if (!selectedEntry) return;
    setIsSyncing(true);

    try {
      await loadFromTmdb(selectedEntry.id, selectedEntry.type);
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

  // Save entry metadata to DB
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
        admin_edited: adminEdited,
        media_updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("entries")
        .update(updateData)
        .eq("id", selectedEntry.id);

      if (error) throw error;

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
  const updateEpisodeField = (
    seasonNum: number,
    epNum: number,
    field: keyof EpisodeMetadata,
    value: any
  ) => {
    setEpisodes((prev) =>
      prev.map((ep) =>
        ep.season_number === seasonNum && ep.episode_number === epNum
          ? { ...ep, [field]: value }
          : ep
      )
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
      admin_edited: ep.admin_edited,
    });

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error || "Failed to save episode.",
        variant: "destructive",
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

  // Add genre
  const handleAddGenre = () => {
    if (!newGenreName.trim()) return;
    const newGenre: Genre = {
      id: Date.now(), // Temporary ID
      name: newGenreName.trim(),
    };
    setGenres([...genres, newGenre]);
    setNewGenreName("");
  };

  // Remove genre
  const handleRemoveGenre = (id: number) => {
    setGenres(genres.filter((g) => g.id !== id));
  };

  // Remove cast member
  const handleRemoveCast = (id: number) => {
    setCastData(castData.filter((c) => c.id !== id));
  };

  // Get episodes for selected season
  const seasonEpisodes = episodes
    .filter((ep) => ep.season_number === selectedSeason)
    .sort((a, b) => a.episode_number - b.episode_number);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit3 className="w-5 h-5" />
          Post Metadata Editor
        </CardTitle>
        <CardDescription>
          Search and edit complete metadata for any post in the database.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Section */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search by title or TMDB ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchDb()}
              className="flex-1"
            />
            <Button
              onClick={handleSearchDb}
              disabled={isSearchingDb || !searchQuery.trim()}
              variant="outline"
              className="gap-1"
            >
              {isSearchingDb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Search DB
            </Button>
            <Button
              onClick={handleSearchTmdb}
              disabled={isSearchingTmdb || !searchQuery.trim()}
              variant="outline"
              className="gap-1"
            >
              {isSearchingTmdb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Search TMDB
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <ScrollArea className="h-48 border rounded-md p-2">
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <div
                    key={`${result.id}-${result.type}`}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary cursor-pointer transition-colors"
                    onClick={() => handleSelectEntry(result)}
                  >
                    {result.posterUrl ? (
                      <img
                        src={result.posterUrl}
                        alt={result.title}
                        className="w-10 h-14 object-cover rounded"
                      />
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
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {result.type === "movie" ? "Movie" : "Series"}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {result.year}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          ID: {result.id}
                        </Badge>
                        {result.inDb && (
                          <Badge className="text-xs bg-green-600">In DB</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {posterUrl && (
                  <img src={posterUrl} alt={title} className="w-16 h-24 object-cover rounded" />
                )}
                <div>
                  <h3 className="font-semibold text-lg">{title || `ID: ${selectedEntry.id}`}</h3>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">
                      {selectedEntry.type === "movie" ? "Movie" : "Series"}
                    </Badge>
                    <Badge variant="secondary">ID: {selectedEntry.id}</Badge>
                    {adminEdited && <Badge className="bg-amber-600">Admin Edited</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClearSelection}>
                  <X className="w-4 h-4 mr-1" /> Close
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncFromTmdb}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  )}
                  Sync from TMDB
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
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

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                />
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
                  <Input
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    placeholder="Released"
                  />
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
                  <Label htmlFor="episodes">Episodes</Label>
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
                  <Input
                    id="poster"
                    value={posterUrl}
                    onChange={(e) => setPosterUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  {posterUrl && (
                    <img src={posterUrl} alt="Poster" className="w-20 h-30 object-cover rounded mt-1" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backdrop">Backdrop URL</Label>
                  <Input
                    id="backdrop"
                    value={backdropUrl}
                    onChange={(e) => setBackdropUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  {backdropUrl && (
                    <img
                      src={backdropUrl}
                      alt="Backdrop"
                      className="w-32 h-18 object-cover rounded mt-1"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo URL</Label>
                  <Input
                    id="logo"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="w-24 h-12 object-contain rounded mt-1 bg-black/50 p-1"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Overview & Tagline */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="overview">Overview</Label>
                <Textarea
                  id="overview"
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  rows={4}
                  placeholder="Enter overview..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Enter tagline..."
                />
              </div>
            </div>

            {/* Genres */}
            <div className="space-y-2">
              <Label>Genres</Label>
              <div className="flex flex-wrap gap-2">
                {genres.map((genre) => (
                  <Badge key={genre.id} variant="secondary" className="gap-1">
                    {genre.name}
                    <button
                      onClick={() => handleRemoveGenre(genre.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex gap-1">
                  <Input
                    value={newGenreName}
                    onChange={(e) => setNewGenreName(e.target.value)}
                    placeholder="Add genre..."
                    className="w-32 h-6 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleAddGenre()}
                  />
                  <Button size="sm" variant="ghost" onClick={handleAddGenre} className="h-6 px-2">
                    <Check className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Cast */}
            <div className="space-y-2">
              <Label>Cast (Top 12)</Label>
              <div className="flex flex-wrap gap-2">
                {castData.map((member) => (
                  <Badge key={member.id} variant="outline" className="gap-1">
                    {member.name}
                    <span className="text-muted-foreground">as {member.character}</span>
                    <button
                      onClick={() => handleRemoveCast(member.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Admin Edited Checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="adminEdited"
                checked={adminEdited}
                onCheckedChange={(checked) => setAdminEdited(!!checked)}
              />
              <Label htmlFor="adminEdited" className="cursor-pointer">
                Mark as Admin Edited (protects from auto-prefill)
              </Label>
            </div>

            {/* Episode Metadata Section (Series Only) */}
            {selectedEntry.type === "series" && (
              <div className="border-t pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Episode Metadata</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncSeason(selectedSeason)}
                      disabled={isSyncing}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Sync Season {selectedSeason}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncAllSeasons}
                      disabled={isSyncing}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Sync All Seasons
                    </Button>
                  </div>
                </div>

                {/* Season Selector */}
                <div className="flex gap-2 flex-wrap">
                  {getAvailableSeasons().map((s) => (
                    <Button
                      key={s}
                      variant={selectedSeason === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSeason(s)}
                    >
                      Season {s}
                    </Button>
                  ))}
                </div>

                {/* Episodes List */}
                <ScrollArea className="h-80 border rounded-md p-2">
                  {seasonEpisodes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No episodes found for Season {selectedSeason}. Click "Sync Season" to fetch from TMDB.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {seasonEpisodes.map((ep) => (
                        <Collapsible
                          key={ep.episode_number}
                          open={expandedEpisode === ep.episode_number}
                          onOpenChange={(open) => setExpandedEpisode(open ? ep.episode_number : null)}
                        >
                          <div className="border rounded-md">
                            <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors">
                              {ep.still_path ? (
                                <img
                                  src={ep.still_path}
                                  alt={ep.name || `Episode ${ep.episode_number}`}
                                  className="w-16 h-9 object-cover rounded"
                                />
                              ) : (
                                <div className="w-16 h-9 bg-muted rounded flex items-center justify-center">
                                  <Film className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 text-left">
                                <p className="font-medium">
                                  E{ep.episode_number}: {ep.name || "Untitled"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate max-w-md">
                                  {ep.overview || "No description"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {ep.admin_edited && (
                                  <Badge variant="secondary" className="text-xs">
                                    Edited
                                  </Badge>
                                )}
                                {expandedEpisode === ep.episode_number ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="p-3 border-t space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Name</Label>
                                  <Input
                                    value={ep.name || ""}
                                    onChange={(e) =>
                                      updateEpisodeField(
                                        ep.season_number,
                                        ep.episode_number,
                                        "name",
                                        e.target.value || null
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Air Date</Label>
                                  <Input
                                    value={ep.air_date || ""}
                                    onChange={(e) =>
                                      updateEpisodeField(
                                        ep.season_number,
                                        ep.episode_number,
                                        "air_date",
                                        e.target.value || null
                                      )
                                    }
                                    className="h-8 text-sm"
                                    placeholder="YYYY-MM-DD"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Thumbnail URL</Label>
                                <Input
                                  value={ep.still_path || ""}
                                  onChange={(e) =>
                                    updateEpisodeField(
                                      ep.season_number,
                                      ep.episode_number,
                                      "still_path",
                                      e.target.value || null
                                    )
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Overview</Label>
                                <Textarea
                                  value={ep.overview || ""}
                                  onChange={(e) =>
                                    updateEpisodeField(
                                      ep.season_number,
                                      ep.episode_number,
                                      "overview",
                                      e.target.value || null
                                    )
                                  }
                                  rows={2}
                                  className="text-sm"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Runtime (min)</Label>
                                  <Input
                                    type="number"
                                    value={ep.runtime ?? ""}
                                    onChange={(e) =>
                                      updateEpisodeField(
                                        ep.season_number,
                                        ep.episode_number,
                                        "runtime",
                                        e.target.value ? Number(e.target.value) : null
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Rating</Label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={ep.vote_average ?? ""}
                                    onChange={(e) =>
                                      updateEpisodeField(
                                        ep.season_number,
                                        ep.episode_number,
                                        "vote_average",
                                        e.target.value ? Number(e.target.value) : null
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={ep.admin_edited}
                                  onCheckedChange={(checked) =>
                                    updateEpisodeField(
                                      ep.season_number,
                                      ep.episode_number,
                                      "admin_edited",
                                      !!checked
                                    )
                                  }
                                />
                                <Label className="text-xs cursor-pointer">Admin Edited</Label>
                              </div>
                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSyncSingleEpisode(ep)}
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Sync from TMDB
                                </Button>
                                <Button size="sm" onClick={() => handleSaveEpisode(ep)}>
                                  <Save className="w-3 h-3 mr-1" />
                                  Save Episode
                                </Button>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
