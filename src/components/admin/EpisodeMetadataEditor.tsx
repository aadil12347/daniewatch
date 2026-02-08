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
}

export function EpisodeMetadataEditor({
  open,
  onOpenChange,
  entryId,
  entryTitle,
  seasonDetails = [],
}: EpisodeMetadataEditorProps) {
  const { toast } = useToast();
  const { fetchEpisodeMetadata, saveEpisodeMetadata, saveSingleEpisode } = useEntryMetadata();

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

  // Load episodes when season changes
  useEffect(() => {
    if (!open || !entryId) return;
    loadEpisodes(selectedSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entryId, selectedSeason]);

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
            admin_edited: ep.admin_edited,
            isExpanded: false,
            isDirty: false,
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
          admin_edited: false,
          isExpanded: false,
          isDirty: true,
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

  const handleEpisodeChange = (
    index: number,
    field: keyof SaveEpisodeInput,
    value: any
  ) => {
    setEpisodes((prev) =>
      prev.map((ep, i) =>
        i === index ? { ...ep, [field]: value, isDirty: true } : ep
      )
    );
  };

  const toggleExpand = (index: number) => {
    setEpisodes((prev) =>
      prev.map((ep, i) =>
        i === index ? { ...ep, isExpanded: !ep.isExpanded } : ep
      )
    );
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const dirtyEpisodes = episodes.filter((ep) => ep.isDirty);

      if (dirtyEpisodes.length === 0) {
        toast({ title: "No changes", description: "Nothing to save." });
        setIsSaving(false);
        return;
      }

      const result = await saveEpisodeMetadata(
        entryId,
        selectedSeason,
        dirtyEpisodes.map((ep) => ({
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
        setEpisodes((prev) => prev.map((ep) => ({ ...ep, isDirty: false })));
        toast({
          title: "Saved",
          description: `${dirtyEpisodes.length} episodes saved successfully.`,
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
    }
  };

  // Bulk add empty episodes
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
    }));

    setEpisodes(prev => [...prev, ...newEpisodes]);
    toast({
      title: "Episodes Added",
      description: `Added ${count} empty episode(s). Edit and save them.`,
    });
  };

  // Toggle episode selection
  const toggleEpisodeSelection = (episodeNumber: number) => {
    setSelectedEpisodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(episodeNumber)) {
        newSet.delete(episodeNumber);
      } else {
        newSet.add(episodeNumber);
      }
      return newSet;
    });
  };

  // Select/Deselect all
  const toggleSelectAll = () => {
    if (selectedEpisodes.size === episodes.length) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(episodes.map(e => e.episode_number)));
    }
  };

  // Bulk delete selected episodes
  const handleBulkDelete = () => {
    const toDelete = episodes.filter(ep => selectedEpisodes.has(ep.episode_number));
    setEpisodes(prev => prev.filter(ep => !selectedEpisodes.has(ep.episode_number)));
    setSelectedEpisodes(new Set());
    toast({
      title: "Episodes Removed",
      description: `Removed ${toDelete.length} episode(s) from local list. Click Save All to persist.`,
    });
  };

  // Sync single episode from TMDB
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

      // Save all episodes for this season
      const episodesToSave = seasonRes.episodes.map(ep => ({
        episode_number: ep.episode_number,
        name: ep.name || null,
        overview: ep.overview || null,
        still_path: ep.still_path ? getImageUrl(ep.still_path, "w300") : null,
        air_date: ep.air_date || null,
        runtime: ep.runtime || null,
        vote_average: ep.vote_average ?? null,
        admin_edited: false,
      }));

      const result = await saveEpisodeMetadata(entryId, seasonNum, episodesToSave);

      if (result.success) {
        toast({
          title: "Season Added",
          description: `Season ${seasonNum} with ${episodesToSave.length} episodes added successfully`,
        });
        setShowAddSeasonDialog(false);
        setNewSeasonNumber("");
        // Refresh if we're viewing this season
        if (selectedSeason === seasonNum) {
          await loadEpisodes(seasonNum);
        }
      }
    } catch (error) {
      console.error("Error adding season:", error);
      toast({
        title: "Failed to Add Season",
        description: "Could not add season from TMDB",
        variant: "destructive",
      });
    } finally {
      setIsAddingSeason(false);
    }
  };

  // Delete current season
  const handleDeleteSeason = async () => {
    setIsDeletingSeason(true);
    try {
      // Delete all episodes for this season
      await saveEpisodeMetadata(entryId, selectedSeason, []);

      toast({
        title: "Season Deleted",
        description: `All episodes for season ${selectedSeason} have been removed`,
      });

      setEpisodes([]);
    } catch (error) {
      console.error("Error deleting season:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete season",
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
        className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col z-[60]"
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

        {/* Season selector & actions */}
        <div className="flex items-center gap-2 pb-2 border-b">
          <Select
            value={String(selectedSeason)}
            onValueChange={(v) => setSelectedSeason(Number(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {seasonDetails.map((s) => (
                <SelectItem key={s.season_number} value={String(s.season_number)}>
                  Season {s.season_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshFromTMDB(selectedSeason)}
            disabled={isRefreshing || isLoading}
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="ml-1">Refresh TMDB</span>
          </Button>

          <div className="flex-1" />

          {/* Bulk Add Episodes */}
          <Input
            type="number"
            min="1"
            max="50"
            value={bulkEpisodeCount}
            onChange={(e) => setBulkEpisodeCount(e.target.value)}
            className="w-16"
            placeholder="#"
          />
          <Button variant="outline" size="sm" onClick={handleBulkAdd}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>

          <Button onClick={handleSaveAll} disabled={isSaving || dirtyCount === 0}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save All {dirtyCount > 0 && `(${dirtyCount})`}
          </Button>
        </div>

        {/* Bulk Selection & Season Management */}
        {episodes.length > 0 && (
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              checked={selectedEpisodes.size === episodes.length && episodes.length > 0}
              onCheckedChange={toggleSelectAll}
              id="select-all"
            />
            <Label htmlFor="select-all" className="text-xs cursor-pointer">
              {selectedEpisodes.size === episodes.length ? "Deselect All" : "Select All"}
            </Label>

            {selectedEpisodes.size > 0 && (
              <>
                <span className="text-xs text-muted-foreground">
                  ({selectedEpisodes.size} selected)
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selectedEpisodes.size} Episode(s)?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove them from the local list. Click "Save All" to persist changes.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            <div className="flex-1" />

            {/* Season Management */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddSeasonDialog(true)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Season
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete Season
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Season {selectedSeason}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all episodes for season {selectedSeason} from the database.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteSeason}
                    disabled={isDeletingSeason}
                    className="bg-destructive"
                  >
                    {isDeletingSeason ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Delete Season
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Add Season Dialog */}
        <Dialog open={showAddSeasonDialog} onOpenChange={setShowAddSeasonDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Season</DialogTitle>
              <DialogDescription className="sr-only">
                Fetch a new season with all episodes from TMDB
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
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
              <Button
                onClick={handleAddSeason}
                disabled={isAddingSeason}
              >
                {isAddingSeason ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
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
            <div className="text-center py-8 text-muted-foreground">
              No episodes found. Click "Refresh TMDB" to load.
            </div>
          ) : (
            episodes.map((ep, index) => (
              <Collapsible
                key={ep.episode_number}
                open={ep.isExpanded}
                onOpenChange={() => toggleExpand(index)}
              >
                <div
                  className={`border rounded-lg ${ep.isDirty ? "border-primary/50 bg-primary/5" : ""
                    }`}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50">
                      {ep.isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}

                      {/* Thumbnail */}
                      {ep.still_path ? (
                        <img
                          src={ep.still_path}
                          alt=""
                          className="w-16 h-9 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-9 bg-secondary rounded flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">E{ep.episode_number}</span>
                          <span className="text-sm truncate">
                            {ep.name || "Untitled"}
                          </span>
                        </div>
                      </div>

                      {ep.admin_edited && (
                        <Badge variant="secondary" className="text-xs">
                          Edited
                        </Badge>
                      )}
                      {ep.isDirty && (
                        <Badge className="text-xs bg-primary/20 text-primary">
                          Unsaved
                        </Badge>
                      )}
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-3 border-t pt-3">
                      {/* Name */}
                      <div>
                        <Label className="text-xs">Episode Name</Label>
                        <Input
                          value={ep.name || ""}
                          onChange={(e) =>
                            handleEpisodeChange(index, "name", e.target.value)
                          }
                          placeholder="Episode name..."
                        />
                      </div>

                      {/* Overview */}
                      <div>
                        <Label className="text-xs">Overview</Label>
                        <Textarea
                          value={ep.overview || ""}
                          onChange={(e) =>
                            handleEpisodeChange(index, "overview", e.target.value)
                          }
                          placeholder="Episode description..."
                          rows={3}
                        />
                      </div>

                      {/* Thumbnail URL */}
                      <div>
                        <Label className="text-xs">Thumbnail URL</Label>
                        <div className="flex gap-2">
                          <Input
                            value={ep.still_path || ""}
                            onChange={(e) =>
                              handleEpisodeChange(index, "still_path", e.target.value)
                            }
                            placeholder="https://..."
                            className="flex-1 font-mono text-xs"
                          />
                          {ep.still_path && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleEpisodeChange(index, "still_path", null)
                              }
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Admin Edited Checkbox */}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`admin-edited-${index}`}
                          checked={ep.admin_edited}
                          onCheckedChange={(checked) =>
                            handleEpisodeChange(index, "admin_edited", !!checked)
                          }
                        />
                        <Label htmlFor={`admin-edited-${index}`} className="text-sm cursor-pointer">
                          Mark as Admin Edited (skip during bulk prefill)
                        </Label>
                      </div>

                      {/* Save single episode */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveSingle(index)}
                        disabled={!ep.isDirty}
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save This Episode
                      </Button>
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
