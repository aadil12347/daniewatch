import { useState } from "react";
import { Search, Loader2, Save, Trash2, Film, Tv, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useEntries } from "@/hooks/useEntries";
import { getMovieDetails, getTVDetails, getImageUrl, MovieDetails, TVDetails } from "@/lib/tmdb";

interface TMDBResult {
  id: number;
  title: string;
  posterUrl: string | null;
  year: string;
  type: "movie" | "series";
  seasons?: number;
  seasonDetails?: { season_number: number; episode_count: number }[];
}

export const UpdateLinksTab = () => {
  const [tmdbId, setTmdbId] = useState("");
  const [mediaType, setMediaType] = useState<"movie" | "series">("movie");
  const [isSearching, setIsSearching] = useState(false);
  const [tmdbResult, setTmdbResult] = useState<TMDBResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Entry state
  const [entryExists, setEntryExists] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  
  // Movie inputs
  const [movieWatchLink, setMovieWatchLink] = useState("");
  const [movieDownloadLink, setMovieDownloadLink] = useState("");
  
  // Series inputs
  const [seriesWatchLinks, setSeriesWatchLinks] = useState("");
  const [seriesDownloadLinks, setSeriesDownloadLinks] = useState("");
  
  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingSeason, setIsDeletingSeason] = useState(false);
  
  const { fetchEntry, saveMovieEntry, saveSeriesSeasonEntry, deleteEntry, deleteSeasonFromEntry } = useEntries();

  const handleSearch = async () => {
    if (!tmdbId.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    setTmdbResult(null);
    setEntryExists(false);
    
    try {
      let result: TMDBResult | null = null;
      let detectedType: "movie" | "series" | null = null;
      
      // Try both APIs in parallel to auto-detect type
      const [movieResult, tvResult] = await Promise.allSettled([
        getMovieDetails(Number(tmdbId)),
        getTVDetails(Number(tmdbId))
      ]);
      
      // Check if movie exists (has a title)
      if (movieResult.status === "fulfilled" && movieResult.value.title) {
        const movie = movieResult.value;
        result = {
          id: movie.id,
          title: movie.title,
          posterUrl: getImageUrl(movie.poster_path, "w185"),
          year: movie.release_date?.split("-")[0] || "N/A",
          type: "movie",
        };
        detectedType = "movie";
      }
      
      // Check if TV show exists (has a name) - prioritize TV if both exist based on which has more data
      if (tvResult.status === "fulfilled" && tvResult.value.name) {
        const show = tvResult.value;
        const validSeasons = show.seasons?.filter(s => s.season_number > 0) || [];
        
        // If both exist, prefer the one that seems more valid (has more details)
        const shouldUseTv = !result || 
          (show.number_of_seasons && show.number_of_seasons > 0) ||
          (show.first_air_date && !result.year);
        
        if (shouldUseTv || !result) {
          result = {
            id: show.id,
            title: show.name || "Unknown",
            posterUrl: getImageUrl(show.poster_path, "w185"),
            year: show.first_air_date?.split("-")[0] || "N/A",
            type: "series",
            seasons: show.number_of_seasons,
            seasonDetails: validSeasons.map(s => ({
              season_number: s.season_number,
              episode_count: s.episode_count,
            })),
          };
          detectedType = "series";
          setSelectedSeason(validSeasons[0]?.season_number || 1);
        }
      }
      
      if (!result) {
        throw new Error("Not found");
      }
      
      // Auto-select the detected type
      if (detectedType) {
        setMediaType(detectedType);
      }
      
      setTmdbResult(result);
      
      // Check if entry exists in database
      const entry = await fetchEntry(String(result.id));
      if (entry) {
        setEntryExists(true);
        
        if (entry.type === "movie") {
          const content = entry.content as { watch_link?: string; download_link?: string };
          setMovieWatchLink(content.watch_link || "");
          setMovieDownloadLink(content.download_link || "");
        } else if (entry.type === "series") {
          // Load first season by default
          const firstSeasonNum = result.seasonDetails?.[0]?.season_number || 1;
          loadSeasonData(entry.content, firstSeasonNum);
        }
      } else {
        // Reset form
        setMovieWatchLink("");
        setMovieDownloadLink("");
        setSeriesWatchLinks("");
        setSeriesDownloadLinks("");
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("Failed to find content with this TMDB ID. Please check the ID and try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const loadSeasonData = async (content: any, season: number) => {
    const seasonKey = `season_${season}`;
    const seasonData = content[seasonKey];
    
    if (seasonData) {
      setSeriesWatchLinks(seasonData.watch_links?.join("\n") || "");
      setSeriesDownloadLinks(seasonData.download_links?.join("\n") || "");
    } else {
      setSeriesWatchLinks("");
      setSeriesDownloadLinks("");
    }
  };

  const handleSeasonChange = async (season: string) => {
    const seasonNum = parseInt(season, 10);
    setSelectedSeason(seasonNum);
    
    if (tmdbResult && entryExists) {
      const entry = await fetchEntry(String(tmdbResult.id));
      if (entry?.type === "series") {
        loadSeasonData(entry.content, seasonNum);
      }
    } else {
      setSeriesWatchLinks("");
      setSeriesDownloadLinks("");
    }
  };

  const handleSave = async () => {
    if (!tmdbResult) return;
    
    setIsSaving(true);
    
    if (mediaType === "movie") {
      const result = await saveMovieEntry(
        String(tmdbResult.id),
        movieWatchLink,
        movieDownloadLink
      );
      if (result.success) {
        setEntryExists(true);
      }
    } else {
      const watchLinks = seriesWatchLinks.split("\n").filter(l => l.trim());
      const downloadLinks = seriesDownloadLinks.split("\n").filter(l => l.trim());
      
      const result = await saveSeriesSeasonEntry(
        String(tmdbResult.id),
        selectedSeason,
        watchLinks,
        downloadLinks
      );
      if (result.success) {
        setEntryExists(true);
      }
    }
    
    setIsSaving(false);
  };

  const handleDeleteEntry = async () => {
    if (!tmdbResult) return;
    
    setIsDeleting(true);
    const result = await deleteEntry(String(tmdbResult.id));
    if (result.success) {
      setEntryExists(false);
      setMovieWatchLink("");
      setMovieDownloadLink("");
      setSeriesWatchLinks("");
      setSeriesDownloadLinks("");
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

  const getWatchLinkCount = () => seriesWatchLinks.split("\n").filter(l => l.trim()).length;
  const getDownloadLinkCount = () => seriesDownloadLinks.split("\n").filter(l => l.trim()).length;
  const getExpectedEpisodeCount = () => {
    if (!tmdbResult?.seasonDetails) return 0;
    const season = tmdbResult.seasonDetails.find(s => s.season_number === selectedSeason);
    return season?.episode_count || 0;
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search by TMDB ID</CardTitle>
          <CardDescription>
            Enter the TMDB ID of the movie or TV show to manage its links
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter TMDB ID (e.g., 93405)"
                value={tmdbId}
                onChange={(e) => setTmdbId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            
            <RadioGroup
              value={mediaType}
              onValueChange={(v) => setMediaType(v as "movie" | "series")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="movie" id="movie" />
                <Label htmlFor="movie" className="flex items-center gap-1 cursor-pointer">
                  <Film className="w-4 h-4" /> Movie
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="series" id="series" />
                <Label htmlFor="series" className="flex items-center gap-1 cursor-pointer">
                  <Tv className="w-4 h-4" /> Series
                </Label>
              </div>
            </RadioGroup>
            
            <Button onClick={handleSearch} disabled={isSearching || !tmdbId.trim()}>
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>
          
          {searchError && (
            <p className="text-sm text-destructive">{searchError}</p>
          )}
        </CardContent>
      </Card>

      {/* Result Card */}
      {tmdbResult && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-start">
              {tmdbResult.posterUrl ? (
                <img
                  src={tmdbResult.posterUrl}
                  alt={tmdbResult.title}
                  className="w-20 h-30 object-cover rounded-lg"
                />
              ) : (
                <div className="w-20 h-30 bg-secondary rounded-lg flex items-center justify-center">
                  {tmdbResult.type === "movie" ? (
                    <Film className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <Tv className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
              )}
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{tmdbResult.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {tmdbResult.year} • {tmdbResult.type === "movie" ? "Movie" : `${tmdbResult.seasons} Season${tmdbResult.seasons !== 1 ? "s" : ""}`}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">TMDB: {tmdbResult.id}</Badge>
                  {entryExists ? (
                    <Badge variant="default" className="bg-green-500">Entry Exists</Badge>
                  ) : (
                    <Badge variant="secondary">New Entry</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movie Form */}
      {tmdbResult && mediaType === "movie" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Movie Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="movieWatch">Watch Online Link (paste full iframe HTML or URL)</Label>
              <Textarea
                id="movieWatch"
                placeholder='<iframe src="https://bysebuho.com/e/..."></iframe>'
                value={movieWatchLink}
                onChange={(e) => setMovieWatchLink(e.target.value)}
                className="min-h-[80px] font-mono text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="movieDownload">Download Link</Label>
              <Input
                id="movieDownload"
                placeholder="https://dldclv-my.sharepoint.com/..."
                value={movieDownloadLink}
                onChange={(e) => setMovieDownloadLink(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Series Form */}
      {tmdbResult && mediaType === "series" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Series Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Season</Label>
              <Select value={String(selectedSeason)} onValueChange={handleSeasonChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tmdbResult.seasonDetails?.map((s) => (
                    <SelectItem key={s.season_number} value={String(s.season_number)}>
                      Season {s.season_number} ({s.episode_count} eps)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="seriesWatch">
                Watch Online Links (one per line, ep1 first, ep2 second, etc.)
              </Label>
              <Textarea
                id="seriesWatch"
                placeholder={'<iframe src="...s01e01..."></iframe>\n<iframe src="...s01e02..."></iframe>\n<iframe src="...s01e03..."></iframe>'}
                value={seriesWatchLinks}
                onChange={(e) => setSeriesWatchLinks(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                {getExpectedEpisodeCount()} episodes in Season {selectedSeason} (TMDB) | {getWatchLinkCount()} watch links entered
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="seriesDownload">
                Download Links (one per line, same order as above)
              </Label>
              <Textarea
                id="seriesDownload"
                placeholder={"https://dldclv.../ep01...\nhttps://dldclv.../ep02...\nhttps://dldclv.../ep03..."}
                value={seriesDownloadLinks}
                onChange={(e) => setSeriesDownloadLinks(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                {getDownloadLinkCount()} download links entered
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {tmdbResult && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {mediaType === "series" ? `Save Season ${selectedSeason}` : "Save Entry"}
          </Button>
          
          {entryExists && mediaType === "series" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive" disabled={isDeletingSeason}>
                  {isDeletingSeason ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
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
                  <AlertDialogAction onClick={handleDeleteSeason} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete Entire Entry
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all watch and download links for this {mediaType === "movie" ? "movie" : "series (all seasons)"}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Entry
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
};
