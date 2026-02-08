import { useEffect, useState } from "react";
import {
  Loader2,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  X,
  Plus,
  Trash2,
  Download,
  ListChecks,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useEntryMetadata, EpisodeMetadata, SaveEpisodeInput } from "@/hooks/useEntryMetadata";
import { useToast } from "@/hooks/use-toast";
import { getTVSeasonDetails, getImageUrl } from "@/lib/tmdb";

interface EpisodeMetadataEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  entryTitle: string;
  seasonDetails?: { season_number: number; episode_count: number }[];
}

interface LocalEpisode extends SaveEpisodeInput {
  isExpanded?: boolean;
  isDirty?: boolean;
  selected?: boolean;  // For granular selection
  tmdbOriginal?: {     // Track original TMDB values for comparison
    name?: string | null;
    overview?: string | null;
    still_path?: string | null;
    air_date?: string | null;
    runtime?: number | null;
    vote_average?: number | null;
  };
}

export function EpisodeMetadataEditor({
  open,
  onOpenChange,
  entryId,
  entryTitle,
  seasonDetails = [],
}: EpisodeMetadataEditorProps) {
  const { toast } = useToast();
  const { fetchEpisodeMetadata, saveEpisodeMetadata, saveSingleEpisode, ensureSeasonInContent, removeSeasonFromContent } = useEntryMetadata();

  const [selectedSeason, setSelectedSeason] = useState(seasonDetails[0]?.season_number || 1);
  const [episodes, setEpisodes] = useState<LocalEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bulk operations state
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<number>>(new Set());
  const [bulkEpisodeCount, setBulkEpisodeCount] = useState("1");
  const [isSyncingSingle, setIsSyncingSingle] = useState<number | null>(null);
  const [showAddSeasonDialog, setShowAddSeasonDialog] = useState(false);
  const [newSeasonNumber, setNewSeasonNumber] = useState("");
  const [isAddingSeason, setIsAddingSeason] = useState(false);
  const [isDeletingSeason, setIsDeletingSeason] = useState(false);
  const [selectionModeEnabled, setSelectionModeEnabled] = useState(false);

  // Load episodes when season changes
  // Load episodes when season changes
  useEffect(() => {
    if (!open || !entryId) return;
    loadEpisodes(selectedSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason, open, entryId]);

  const loadEpisodes = async (season: number) => {
    setIsLoading(true);
    try {
      // First try to load from DB
      const dbEpisodes = await fetchEpisodeMetadata(entryId, season);

      if (dbEpisodes.length > 0) {
        setEpisodes(
          dbEpisodes.map((ep) => ({
            episode_number: ep.episode_number,
            name: ep.name,
            overview: ep.overview,
            still_path: ep.still_path,
            air_date: ep.air_date,
            runtime: ep.runtime,
            vote_average: ep.vote_average,
            admin_edited: ep.admin_edited || false,
            isExpanded: false,
            isDirty: false,
            selected: false,  // Initialize selection
            tmdbOriginal: {   // Store current values as TMDB originals
              name: ep.name,
              overview: ep.overview,
              still_path: ep.still_path,
              air_date: ep.air_date,
              runtime: ep.runtime,
              vote_average: ep.vote_average,
            },
          }))
        );
      } else {
        // Fall back to TMDB
        await refreshFromTMDB(season, false);
      }
    } catch (error) {
      console.error("Error loading episodes:", error);
      toast({
        title: "Error",
        description: "Failed to load episode data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshFromTMDB = async (season: number, showToast = true) => {
    setIsRefreshing(true);
    try {
      const seasonRes = await getTVSeasonDetails(Number(entryId), season);

      if (!seasonRes?.episodes?.length) {
        if (showToast) {
          toast({
            title: "No episodes found",
            description: "TMDB returned no episodes for this season.",
          });
        }
        setEpisodes([]);
        return;
      }

      setEpisodes(
        seasonRes.episodes.map((ep) => ({
          episode_number: ep.episode_number,
          name: ep.name || null,
          overview: ep.overview || null,
          still_path: ep.still_path ? getImageUrl(ep.still_path, "w300") : null,
          air_date: ep.air_date || null,
          runtime: ep.runtime || null,
          vote_average: ep.vote_average ?? null,
          admin_edited: false, // Syncing resets admin_edited to false
          isExpanded: false,
          isDirty: true,
          selected: false,
          tmdbOriginal: {
            name: ep.name || null,
            overview: ep.overview || null,
            still_path: ep.still_path ? getImageUrl(ep.still_path, "w300") : null,
            air_date: ep.air_date || null,
            runtime: ep.runtime || null,
            vote_average: ep.vote_average ?? null,
          },
        }))
      );

      if (showToast) {
        toast({
          title: "Refreshed from TMDB",
          description: `Loaded ${seasonRes.episodes.length} episodes. Click Save All to persist.`,
        });
      }
    } catch (error) {
      console.error("Error refreshing from TMDB:", error);
      if (showToast) {
        toast({
          title: "Error",
          description: "Failed to fetch from TMDB.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  /* Smart Admin Edited Logic:
     Only mark as admin_edited if the new value differs from TMDB original.
  */
  const handleEpisodeChange = (
    index: number,
    field: keyof SaveEpisodeInput,
    value: any
  ) => {
    setEpisodes((prev) =>
      prev.map((ep, i) => {
        if (i !== index) return ep;

        const updatedEp = { ...ep, [field]: value };

        // precise check against original TMDB value
        let isAdminEdited = ep.admin_edited;

        if (ep.tmdbOriginal) {
          const originalValue = ep.tmdbOriginal[field as keyof typeof ep.tmdbOriginal];
          // If field exists in TMDB original and value is different, mark as edited
          if (originalValue !== undefined && originalValue !== value) {
            isAdminEdited = true;
          }
        } else {
          // If no TMDB original, any change is an edit (unless it was already edited)
          isAdminEdited = true;
        }

        return { ...updatedEp, admin_edited: isAdminEdited, isDirty: true };
      })
    );
  };

  const toggleExpand = (index: number) => {
    setEpisodes((prev) =>
      prev.map((ep, i) =>
        i === index ? { ...ep, isExpanded: !ep.isExpanded } : ep
      )
    );
  };

  const handleSaveSelected = async () => {
    const episodesToSave = episodes.filter((ep) => ep.selected);

    if (episodesToSave.length === 0) {
      toast({ title: "No selection", description: "Select episodes to save." });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveEpisodeMetadata(
        entryId,
        selectedSeason,
        episodesToSave.map((ep) => ({
          episode_number: ep.episode_number,
          name: ep.name,
          overview: ep.overview,
          still_path: ep.still_path,
          air_date: ep.air_date,
          runtime: ep.runtime,
          vote_average: ep.vote_average,
          admin_edited: ep.admin_edited,
        }))
      );

      if (result.success) {
        setEpisodes((prev) =>
          prev.map((ep) => ep.selected ? { ...ep, isDirty: false } : ep)
        );
        toast({
          title: "Saved",
          description: `Saved ${episodesToSave.length} episodes.`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save episodes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSingle = async (index: number) => {
    const ep = episodes[index];
    const result = await saveSingleEpisode(entryId, selectedSeason, {
      episode_number: ep.episode_number,
      name: ep.name,
      overview: ep.overview,
      still_path: ep.still_path,
      air_date: ep.air_date,
      runtime: ep.runtime,
      vote_average: ep.vote_average,
      admin_edited: ep.admin_edited,
    });

    if (result.success) {
      setEpisodes((prev) =>
        prev.map((e, i) => (i === index ? { ...e, isDirty: false } : e))
      );
      toast({
        title: "Saved",
        description: `Episode ${ep.episode_number} saved.`,
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to save episode.",
        variant: "destructive",
      });
    }
  };

  const handleBulkAdd = () => {
    const count = parseInt(bulkEpisodeCount);
    if (isNaN(count) || count < 1 || count > 50) {
      toast({
        title: "Invalid Count",
        description: "Please enter a number between 1 and 50",
        variant: "destructive",
      });
      return;
    }

    const maxEpisodeNum = episodes.length > 0 ? Math.max(...episodes.map(e => e.episode_number)) : 0;
    const newEpisodes: LocalEpisode[] = Array.from({ length: count }, (_, i) => ({
      episode_number: maxEpisodeNum + i + 1,
      name: `Episode ${maxEpisodeNum + i + 1}`,
      overview: null,
      still_path: null,
      air_date: null,
      runtime: null,
      vote_average: null,
      admin_edited: false,
      isExpanded: false,
      isDirty: true,
      selected: true,
      tmdbOriginal: {},
    }));

    setEpisodes(prev => [...prev, ...newEpisodes]);
    toast({
      title: "Episodes Added",
      description: `Added ${count} empty episode(s). Edit and save them.`,
    });
  };

  const toggleEpisodeSelection = (episodeNumber: number) => {
    setEpisodes(prev => prev.map(ep =>
      ep.episode_number === episodeNumber ? { ...ep, selected: !ep.selected } : ep
    ));
  };

  const toggleSelectAll = () => {
    const allSelected = episodes.length > 0 && episodes.every(ep => ep.selected);
    setEpisodes(prev => prev.map(ep => ({ ...ep, selected: !allSelected })));
  };

  const handleBulkDelete = () => {
    const toDelete = episodes.filter((ep) => ep.selected);
    if (toDelete.length === 0) return;

    setEpisodes(prev => prev.filter(ep => !ep.selected));
    toast({
      title: "Episodes Removed",
      description: `Removed ${toDelete.length} episode(s) from local list.`,
    });
  };

  const handleSyncSingleEpisode = async (index: number) => {
    const ep = episodes[index];
    setIsSyncingSingle(ep.episode_number);

    try {
      const seasonRes = await getTVSeasonDetails(Number(entryId), selectedSeason);
      const tmdbEp = seasonRes?.episodes?.find(e => e.episode_number === ep.episode_number);

      if (!tmdbEp) {
        toast({
          title: "Not Found",
          description: `Episode ${ep.episode_number} not found on TMDB`,
          variant: "destructive",
        });
        return;
      }

      setEpisodes(prev => prev.map((e, i) => i === index ? {
        ...e,
        name: tmdbEp.name || null,
        overview: tmdbEp.overview || null,
        still_path: tmdbEp.still_path ? getImageUrl(tmdbEp.still_path, "w300") : null,
        air_date: tmdbEp.air_date || null,
        runtime: tmdbEp.runtime || null,
        vote_average: tmdbEp.vote_average ?? null,
        isDirty: true,
        admin_edited: false,
        tmdbOriginal: {
          name: tmdbEp.name || null,
          overview: tmdbEp.overview || null,
          still_path: tmdbEp.still_path ? getImageUrl(tmdbEp.still_path, "w300") : null,
          air_date: tmdbEp.air_date || null,
          runtime: tmdbEp.runtime || null,
          vote_average: tmdbEp.vote_average ?? null,
        }
      } : e));

      toast({
        title: "Synced from TMDB",
        description: `Episode ${ep.episode_number} updated with latest TMDB data`,
      });
    } catch (error) {
      console.error("Error syncing episode:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to fetch episode from TMDB",
        variant: "destructive",
      });
    } finally {
      setIsSyncingSingle(null);
    }
  };

  // Add new season
  const handleAddSeason = async () => {
    const seasonNum = parseInt(newSeasonNumber);
    if (isNaN(seasonNum) || seasonNum < 0) {
      toast({
        title: "Invalid Season",
        description: "Please enter a valid season number",
        variant: "destructive",
      });
      return;
    }

    setIsAddingSeason(true);
    try {
      const seasonRes = await getTVSeasonDetails(Number(entryId), seasonNum);

      if (!seasonRes?.episodes?.length) {
        toast({
          title: "No Episodes Found",
          description: `Season ${seasonNum} has no episodes on TMDB`,
          variant: "destructive",
        });
        return;
      }

      const episodesToSave = seasonRes.episodes.map((ep) => ({
        episode_number: ep.episode_number,
        name: ep.name || null,
        overview: ep.overview || null,
        still_path: ep.still_path
          ? getImageUrl(ep.still_path, "w300")
          : null,
        air_date: ep.air_date || null,
        runtime: ep.runtime || null,
        vote_average: ep.vote_average ?? null,
        admin_edited: false,
      }));

      const metadataResult = await saveEpisodeMetadata(
        entryId,
        seasonNum,
        episodesToSave
      );

      if (!metadataResult.success) throw new Error(metadataResult.error);

      // Ensure entries table content has season key
      const ensureResult = await ensureSeasonInContent(entryId, seasonNum);
      if (!ensureResult.success) throw new Error(ensureResult.error);

      toast({
        title: "Season Added",
        description: `Season ${seasonNum} initialized with ${episodesToSave.length} episodes.`,
      });

      setShowAddSeasonDialog(false);
      setNewSeasonNumber("");

      if (selectedSeason === seasonNum) {
        await loadEpisodes(seasonNum);
      } else {
        setSelectedSeason(seasonNum);
      }
    } catch (error: any) {
      console.error("Error adding season:", error);
      toast({
        title: "Failed to Add Season",
        description: error.message || "Could not add season",
        variant: "destructive",
      });
    } finally {
      setIsAddingSeason(false);
    }
  };

  const handleDeleteSeason = async () => {
    setIsDeletingSeason(true);
    try {
      // 1. Remove metadata rows
      const deleteMetaResult = await saveEpisodeMetadata(
        entryId,
        selectedSeason,
        []
      );
      if (!deleteMetaResult.success) throw new Error(deleteMetaResult.error);

      // 2. Remove season key from entries.content
      const removeContentResult = await removeSeasonFromContent(
        entryId,
        selectedSeason
      );
      if (!removeContentResult.success) throw new Error(removeContentResult.error);

      toast({
        title: "Season Deleted",
        description: `All episodes for season ${selectedSeason} have been removed`,
      });

      setEpisodes([]);
    } catch (error: any) {
      console.error("Error deleting season:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete season",
        variant: "destructive",
      });
    } finally {
      setIsDeletingSeason(false);
    }
  };

  const dirtyCount = episodes.filter((ep) => ep.isDirty).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col z-[60]"
        overlayClassName="z-[60]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Episode Metadata</span>
            <Badge variant="outline">{entryTitle}</Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Edit episode metadata for {entryTitle}, season {selectedSeason}
          </DialogDescription>
        </DialogHeader>

        {/* Top Bar: Season Selector, Refresh, Bulk Actions */}
        <div className="flex flex-wrap items-center gap-4 pb-4 border-b">
          {/* Season Selector */}
          <div className="flex items-center gap-2">
            <Select
              value={String(selectedSeason)}
              onValueChange={(v) => {
                if (v === "new_season") {
                  setShowAddSeasonDialog(true);
                } else {
                  // This updates state, which triggers useEffect -> loadEpisodes
                  setSelectedSeason(Number(v));
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Season" />
              </SelectTrigger>
              <SelectContent>
                {seasonDetails.map((s) => (
                  <SelectItem
                    key={s.season_number}
                    value={String(s.season_number)}
                  >
                    Season {s.season_number} ({s.episode_count} eps)
                  </SelectItem>
                ))}
                <SelectItem
                  value="new_season"
                  className="text-primary font-medium border-t mt-1"
                >
                  <Plus className="w-3 h-3 mr-2 inline" /> Add New Season
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => refreshFromTMDB(selectedSeason)}
              disabled={isRefreshing || isLoading}
              title="Refresh from TMDB"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          <div className="h-6 w-px bg-border mx-2" />

          <div className="flex-1" />

          {/* Add Episodes (Relocated) */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
              Add Episodes:
            </span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="1"
                max="50"
                value={bulkEpisodeCount}
                onChange={(e) => setBulkEpisodeCount(e.target.value)}
                className="w-16 h-8 bg-background"
                placeholder="#"
              />
              <Button variant="outline" size="sm" onClick={handleBulkAdd} className="h-8">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>

          <div className="h-6 w-px bg-border mx-2" />

          {/* Save Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`h-8 ${selectionModeEnabled ? "bg-primary/10 border-primary/50 text-primary" : ""}`}
              onClick={() => setSelectionModeEnabled(!selectionModeEnabled)}
            >
              {selectionModeEnabled ? (
                <Check className="w-3 h-3 mr-1" />
              ) : (
                <ListChecks className="w-3 h-3 mr-1" />
              )}
              {selectionModeEnabled ? "Done Selecting" : "Select"}
            </Button>

            {selectionModeEnabled && (
              <span className="text-sm text-muted-foreground mr-1">
                {episodes.filter((e) => e.selected).length} selected
              </span>
            )}

            <Button
              onClick={handleSaveSelected}
              disabled={
                isSaving ||
                (selectionModeEnabled &&
                  episodes.filter((e) => e.selected).length === 0)
              }
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              {selectionModeEnabled ? "Save Selected" : "Save All"}
            </Button>
          </div>
        </div>

        {/* Sub Bar: Bulk Operations (Select All, Delete) */}
        {selectionModeEnabled && (
          <div className="flex items-center justify-between py-2 px-1 bg-muted/30 rounded-md mb-2 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 ml-2">
              <Checkbox
                id="select-all-toggle"
                checked={episodes.length > 0 && episodes.every((e) => e.selected)}
                onCheckedChange={toggleSelectAll}
              />
              <Label
                htmlFor="select-all-toggle"
                className="text-sm cursor-pointer select-none"
              >
                Select All
              </Label>
            </div>

            <div className="flex items-center gap-2">
              {episodes.some((e) => e.selected) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="h-8"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete Selected
                </Button>
              )}

              <div className="h-4 w-px bg-border mx-2" />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-8 hover:bg-destructive/10"
                  >
                    Delete Season {selectedSeason}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete Season {selectedSeason}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all episodes for season{" "}
                      {selectedSeason} from the database.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteSeason}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {isDeletingSeason ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-1" />
                      )}
                      Delete Season
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {/* Add Season Dialog (Nested) */}
        <Dialog open={showAddSeasonDialog} onOpenChange={setShowAddSeasonDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Season</DialogTitle>
              <DialogDescription className="sr-only">
                Fetch a new season with all episodes from TMDB
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="season-number">Season Number</Label>
                <Input
                  id="season-number"
                  type="number"
                  min="0"
                  value={newSeasonNumber}
                  onChange={(e) => setNewSeasonNumber(e.target.value)}
                  placeholder="e.g., 2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddSeasonDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSeason} disabled={isAddingSeason}>
                {isAddingSeason ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                Fetch from TMDB
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Episodes list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))
          ) : episodes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <p>No episodes found for Season {selectedSeason}.</p>
              <Button variant="link" onClick={() => refreshFromTMDB(selectedSeason)}>
                Click to refresh from TMDB
              </Button>
            </div>
          ) : (
            episodes.map((ep, index) => (
              <Collapsible
                key={ep.episode_number}
                open={ep.isExpanded}
                onOpenChange={() => toggleExpand(index)}
              >
                <div
                  className={`border rounded-lg transition-colors ${ep.isDirty ? "border-amber-500/50 bg-amber-500/5" : ""
                    } ${ep.selected ? "ring-1 ring-primary border-primary" : ""}`}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 group select-none">
                      {/* Granular Selection Checkbox */}
                      {selectionModeEnabled && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center p-1 animate-in fade-in zoom-in duration-200"
                        >
                          <Checkbox
                            checked={!!ep.selected}
                            onCheckedChange={(checked) => {
                              setEpisodes((prev) =>
                                prev.map((e, i) =>
                                  i === index ? { ...e, selected: !!checked } : e
                                )
                              );
                            }}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-xs font-medium text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {ep.isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <span className="text-[10px]">
                            {ep.episode_number}
                          </span>
                        )}
                      </div>

                      {/* Thumbnail Preview */}
                      <div className="relative w-16 h-9 rounded overflow-hidden bg-muted">
                        {ep.still_path ? (
                          <img src={ep.still_path} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{ep.name || `Episode ${ep.episode_number}`}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground h-4">
                          {ep.air_date && <span>{new Date(ep.air_date).getFullYear()}</span>}
                          {ep.runtime && <span>• {ep.runtime}m</span>}
                          {ep.vote_average && <span>• ★ {ep.vote_average.toFixed(1)}</span>}
                        </div>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleSyncSingleEpisode(index)}
                          disabled={isSyncingSingle === ep.episode_number}
                          title="Sync only this episode from TMDB"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSyncingSingle === ep.episode_number ? "animate-spin" : ""}`} />
                        </Button>
                      </div>

                      {ep.admin_edited && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          Edited
                        </Badge>
                      )}
                      {ep.isDirty && (
                        <Badge className="text-[10px] h-5 px-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0">
                          Unsaved
                        </Badge>
                      )}
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4 border-t pt-4 bg-muted/10">
                      {/* Episode Editing Fields */}
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold">Episode Name</Label>
                          <Input
                            value={ep.name || ""}
                            onChange={(e) => handleEpisodeChange(index, "name", e.target.value)}
                            placeholder="Episode title"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold">Overview</Label>
                          <Textarea
                            value={ep.overview || ""}
                            onChange={(e) => handleEpisodeChange(index, "overview", e.target.value)}
                            placeholder="Plot summary..."
                            rows={3}
                            className="resize-none"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold">Thumbnail URL</Label>
                          <div className="flex gap-2">
                            <Input
                              value={ep.still_path || ""}
                              onChange={(e) => handleEpisodeChange(index, "still_path", e.target.value)}
                              placeholder="https://image.tmdb.org/..."
                              className="font-mono text-xs"
                            />
                            {ep.still_path && (
                              <Button variant="ghost" size="icon" onClick={() => handleEpisodeChange(index, "still_path", null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`admin-edited-${index}`}
                              checked={ep.admin_edited}
                              onCheckedChange={(checked) => handleEpisodeChange(index, "admin_edited", !!checked)}
                            />
                            <Label htmlFor={`admin-edited-${index}`} className="text-xs cursor-pointer text-muted-foreground">
                              Force "Admin Edited" status
                            </Label>
                          </div>

                          <div className="flex-1" />

                          <Button size="sm" onClick={() => handleSaveSingle(index)} disabled={!ep.isDirty} className="h-8">
                            <Save className="w-3 h-3 mr-2" /> Save Changes
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
