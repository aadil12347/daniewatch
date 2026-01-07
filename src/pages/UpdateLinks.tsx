import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useEntries } from "@/hooks/useEntries";
import { useEntriesTrash, TrashedEntry } from "@/hooks/useEntriesTrash";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Shield, 
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
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getMovieDetails, getTVDetails, getImageUrl } from "@/lib/tmdb";
import { supabase } from "@/integrations/supabase/client";

interface TMDBResult {
  id: number;
  title: string;
  posterUrl: string | null;
  year: string;
  type: "movie" | "series";
  seasons?: number;
  seasonDetails?: { season_number: number; episode_count: number }[];
}

const UpdateLinks = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading } = useAdmin();
  const { toast } = useToast();
  const { fetchEntry, saveMovieEntry, saveSeriesSeasonEntry, deleteEntry, deleteSeasonFromEntry } = useEntries();
  const { trashedEntries, moveToTrash, restoreFromTrash, permanentlyDelete, emptyTrash } = useEntriesTrash();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"update" | "trash">("update");
  
  // Search state
  const [tmdbId, setTmdbId] = useState("");
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
  
  // Collapsible states for link boxes
  const [watchLinksExpanded, setWatchLinksExpanded] = useState(false);
  const [downloadLinksExpanded, setDownloadLinksExpanded] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!tmdbId.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    setTmdbResult(null);
    setEntryExists(false);
    
    try {
      let result: TMDBResult | null = null;
      
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
          posterUrl: getImageUrl(movie.poster_path, "w342"),
          year: movie.release_date?.split("-")[0] || "N/A",
          type: "movie",
        };
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
            posterUrl: getImageUrl(show.poster_path, "w342"),
            year: show.first_air_date?.split("-")[0] || "N/A",
            type: "series",
            seasons: show.number_of_seasons,
            seasonDetails: validSeasons.map(s => ({
              season_number: s.season_number,
              episode_count: s.episode_count,
            })),
          };
          setSelectedSeason(validSeasons[0]?.season_number || 1);
        }
      }
      
      if (!result) {
        throw new Error("Not found");
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
  }, [tmdbId, fetchEntry]);

  // Read URL params on mount and trigger search
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      setTmdbId(idParam);
      // Trigger search after a brief delay to ensure state is set
      setTimeout(() => {
        handleSearch();
      }, 100);
    }
  }, []);

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
    
    if (tmdbResult.type === "movie") {
      const result = await saveMovieEntry(
        String(tmdbResult.id),
        movieWatchLink,
        movieDownloadLink
      );
      if (result.success) {
        setEntryExists(true);
        toast({ title: "Saved", description: "Movie links saved successfully." });
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
        toast({ title: "Saved", description: `Season ${selectedSeason} links saved successfully.` });
      }
    }
    
    setIsSaving(false);
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
    const { error } = await supabase
      .from("entries")
      .upsert({
        id: entry.id,
        type: entry.type,
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
        setMovieWatchLink(prev => prev ? `${prev}\n${text}` : text);
      } else {
        setSeriesWatchLinks(prev => prev ? `${prev}\n${text}` : text);
      }
      toast({ title: "Pasted", description: "Content pasted from clipboard." });
    } catch {
      toast({ title: "Error", description: "Failed to read clipboard.", variant: "destructive" });
    }
  };

  const handlePasteDownload = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (tmdbResult?.type === "movie") {
        setMovieDownloadLink(prev => prev ? `${prev}\n${text}` : text);
      } else {
        setSeriesDownloadLinks(prev => prev ? `${prev}\n${text}` : text);
      }
      toast({ title: "Pasted", description: "Content pasted from clipboard." });
    } catch {
      toast({ title: "Error", description: "Failed to read clipboard.", variant: "destructive" });
    }
  };

  // Link counts
  const getWatchLinkCount = () => {
    if (tmdbResult?.type === "movie") {
      return movieWatchLink.trim() ? 1 : 0;
    }
    return seriesWatchLinks.split("\n").filter(l => l.trim()).length;
  };
  
  const getDownloadLinkCount = () => {
    if (tmdbResult?.type === "movie") {
      return movieDownloadLink.trim() ? 1 : 0;
    }
    return seriesDownloadLinks.split("\n").filter(l => l.trim()).length;
  };
  
  const getExpectedEpisodeCount = () => {
    if (!tmdbResult?.seasonDetails) return 0;
    const season = tmdbResult.seasonDetails.find(s => s.season_number === selectedSeason);
    return season?.episode_count || 0;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 text-center">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">Admin Access Required</h1>
          <p className="text-muted-foreground mb-6">Please sign in to access this page.</p>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 text-center">
          <Shield className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">You don't have permission to access this page.</p>
          <Button asChild>
            <Link to="/">Go Home</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Update Links - Admin - DanieWatch</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
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
              <p className="text-muted-foreground mt-1">
                Manage watch and download links for movies and series
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "update" | "trash")} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="update" className="gap-2">
                <Link2 className="w-4 h-4" />
                Update Links
              </TabsTrigger>
              <TabsTrigger value="trash" className="gap-2">
                <Archive className="w-4 h-4" />
                Trash ({trashedEntries.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="update" className="space-y-4">
              {/* Search Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Search by TMDB ID</CardTitle>
                  <CardDescription>
                    Enter the TMDB ID and press Search or Enter
                  </CardDescription>
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
                    <p className="text-sm text-destructive mt-2">{searchError}</p>
                  )}
                </CardContent>
              </Card>

              {/* Links Form - Shown first, above poster */}
              {tmdbResult && (
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    {/* Watch Online - Collapsible */}
                    <Collapsible open={watchLinksExpanded} onOpenChange={setWatchLinksExpanded}>
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Watch Online</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {getWatchLinkCount()} links
                            {tmdbResult.type === "series" && ` / ${getExpectedEpisodeCount()} ep`}
                          </span>
                          <Button variant="ghost" size="sm" onClick={handlePasteWatch} className="gap-1 h-7 px-2">
                            <ClipboardPaste className="w-3 h-3" />
                            Paste
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2">
                              {watchLinksExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      
                      {/* Preview when collapsed */}
                      {!watchLinksExpanded && (
                        <div 
                          className="mt-2 p-2 bg-muted/50 rounded-md text-xs font-mono text-muted-foreground truncate cursor-pointer"
                          onClick={() => setWatchLinksExpanded(true)}
                        >
                          {tmdbResult.type === "movie" 
                            ? (movieWatchLink || "Click to add watch link...")
                            : (seriesWatchLinks.split('\n')[0] || "Click to add watch links...")}
                        </div>
                      )}
                      
                      <CollapsibleContent>
                        {tmdbResult.type === "movie" ? (
                          <Textarea
                            value={movieWatchLink}
                            onChange={(e) => setMovieWatchLink(e.target.value)}
                            className="mt-2 min-h-[80px] font-mono text-sm"
                            placeholder="Paste watch link here..."
                          />
                        ) : (
                          <Textarea
                            value={seriesWatchLinks}
                            onChange={(e) => setSeriesWatchLinks(e.target.value)}
                            className="mt-2 font-mono text-sm"
                            style={{ minHeight: Math.max(80, Math.min(300, getWatchLinkCount() * 24 + 40)) }}
                            placeholder="Paste episode links here (one per line)..."
                          />
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                    
                    {/* Download Links - Collapsible */}
                    <Collapsible open={downloadLinksExpanded} onOpenChange={setDownloadLinksExpanded}>
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Download Links</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {getDownloadLinkCount()} links
                          </span>
                          <Button variant="ghost" size="sm" onClick={handlePasteDownload} className="gap-1 h-7 px-2">
                            <ClipboardPaste className="w-3 h-3" />
                            Paste
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2">
                              {downloadLinksExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      
                      {/* Preview when collapsed */}
                      {!downloadLinksExpanded && (
                        <div 
                          className="mt-2 p-2 bg-muted/50 rounded-md text-xs font-mono text-muted-foreground truncate cursor-pointer"
                          onClick={() => setDownloadLinksExpanded(true)}
                        >
                          {tmdbResult.type === "movie" 
                            ? (movieDownloadLink || "Click to add download link...")
                            : (seriesDownloadLinks.split('\n')[0] || "Click to add download links...")}
                        </div>
                      )}
                      
                      <CollapsibleContent>
                        {tmdbResult.type === "movie" ? (
                          <Input
                            value={movieDownloadLink}
                            onChange={(e) => setMovieDownloadLink(e.target.value)}
                            className="mt-2 font-mono text-sm"
                            placeholder="Paste download link here..."
                          />
                        ) : (
                          <Textarea
                            value={seriesDownloadLinks}
                            onChange={(e) => setSeriesDownloadLinks(e.target.value)}
                            className="mt-2 font-mono text-sm"
                            style={{ minHeight: Math.max(80, Math.min(300, getDownloadLinkCount() * 24 + 40)) }}
                            placeholder="Paste download links here (one per line)..."
                          />
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              )}

              {/* Compact Result Card with Poster and Details */}
              {tmdbResult && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex gap-4 items-start">
                      {/* Small Poster */}
                      <div className="flex-shrink-0">
                        {tmdbResult.posterUrl ? (
                          <img
                            src={tmdbResult.posterUrl}
                            alt={tmdbResult.title}
                            className="w-16 h-24 object-cover rounded-lg shadow-md"
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
                          <Badge variant="outline" className="text-xs">TMDB: {tmdbResult.id}</Badge>
                          {entryExists ? (
                            <Badge variant="default" className="bg-green-500 text-xs">Exists</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">New</Badge>
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

              {/* Action Buttons */}
              {tmdbResult && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {tmdbResult.type === "series" ? `Save Season ${selectedSeason}` : "Save Entry"}
                  </Button>
                  
                  {entryExists && tmdbResult.type === "series" && (
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
                            This will move all watch and download links for "{tmdbResult.title}" to trash.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                      <AlertDialogAction onClick={handleEmptyTrash} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                    <p className="text-muted-foreground">
                      Deleted entries will appear here for recovery.
                    </p>
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
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRestoreEntry(entry)}
                              className="gap-1"
                            >
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
          </Tabs>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default UpdateLinks;
