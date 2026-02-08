import { useEffect, useState } from "react";
import {
  Loader2,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  X,
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
} from "@/components/ui/dialog";
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

          <Button onClick={handleSaveAll} disabled={isSaving || dirtyCount === 0}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save All {dirtyCount > 0 && `(${dirtyCount})`}
          </Button>
        </div>

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
