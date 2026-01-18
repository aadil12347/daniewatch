import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Loader2, Save, ShieldOff } from "lucide-react";

import { useEntries } from "@/hooks/useEntries";
import { usePostModeration } from "@/hooks/usePostModeration";
import { getTVDetails } from "@/lib/tmdb";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Props = {
  tmdbId: string;
  mediaType: "movie" | "tv";
  title?: string;
  posterPath?: string;
};

export function QuickEditLinksDropdown({ tmdbId, mediaType, title, posterPath }: Props) {
  const { fetchEntry, saveMovieEntry, saveSeriesSeasonEntry } = useEntries();
  const { isBlocked, blockPost, unblockPost } = usePostModeration();

  const isSeries = mediaType === "tv";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const blocked = isBlocked(tmdbId, mediaType);

  const [movieWatch, setMovieWatch] = useState("");
  const [movieDownload, setMovieDownload] = useState("");

  const [seasonCount, setSeasonCount] = useState<number>(0);
  const seasons = useMemo(() => Array.from({ length: seasonCount }, (_, i) => i + 1), [seasonCount]);

  const [season, setSeason] = useState<number>(1);
  const [seriesWatchLinks, setSeriesWatchLinks] = useState("");
  const [seriesDownloadLinks, setSeriesDownloadLinks] = useState("");

  const didInitRef = useRef(false);

  const loadSeriesSeasonFromEntry = async (seasonNum: number) => {
    const entry = await fetchEntry(tmdbId);
    if (!entry || entry.type !== "series") {
      setSeriesWatchLinks("");
      setSeriesDownloadLinks("");
      return;
    }

    const seasonKey = `season_${seasonNum}`;
    const content = entry.content as any;
    const data = content?.[seasonKey];

    setSeriesWatchLinks(data?.watch_links?.join("\n") || "");
    setSeriesDownloadLinks(data?.download_links?.join("\n") || "");
  };

  const init = async () => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    setLoading(true);
    try {
      // Prefill from DB (if any)
      const entry = await fetchEntry(tmdbId);
      if (entry?.type === "movie") {
        const content = entry.content as any;
        setMovieWatch(content?.watch_link || "");
        setMovieDownload(content?.download_link || "");
      }

      if (isSeries) {
        // Season list from TMDB
        const tv = await getTVDetails(Number(tmdbId));
        const count = tv.number_of_seasons || 0;
        setSeasonCount(count);
        const initialSeason = 1;
        setSeason(initialSeason);

        // Prefill selected season from DB if exists
        await loadSeriesSeasonFromEntry(initialSeason);
      }
    } finally {
      setLoading(false);
    }
  };

  // Initialize lazily when the dropdown content is rendered
  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId]);

  const onSeasonChange = async (value: string) => {
    const seasonNum = Number(value);
    setSeason(seasonNum);
    await loadSeriesSeasonFromEntry(seasonNum);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!isSeries) {
        await saveMovieEntry(tmdbId, movieWatch, movieDownload);
        toast.success("Links saved");
        return;
      }

      const watchLinks = seriesWatchLinks
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const downloadLinks = seriesDownloadLinks
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      await saveSeriesSeasonEntry(tmdbId, season, watchLinks, downloadLinks);
      toast.success("Links saved");
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleBlockToggle = async () => {
    setBlocking(true);
    try {
      if (blocked) {
        await unblockPost(tmdbId, mediaType);
        toast.success(`"${title || "Post"}" unblocked`);
      } else {
        await blockPost(tmdbId, mediaType, title, posterPath);
        toast.success(`"${title || "Post"}" blocked`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Action failed. Please check your Supabase RLS policies.");
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div
      className="w-[360px] p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Quick Edit Links</p>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={blocked ? "secondary" : "destructive"}
            onClick={handleBlockToggle}
            disabled={blocking || saving || loading}
            className="shrink-0"
          >
            {blocked ? (
              <ShieldOff className="h-4 w-4" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            <span className="ml-2">{blocked ? "Unblock" : "Block"}</span>
          </Button>

          <Button size="sm" onClick={handleSave} disabled={saving || loading || blocking} className="shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-2">Save</span>
          </Button>
        </div>
      </div>

      <Separator className="my-3" />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {isSeries && (
            <div className="space-y-2">
              <Label>Season</Label>
              <Select value={String(season)} onValueChange={onSeasonChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      Season {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Watch</Label>
            {isSeries ? (
              <Textarea
                value={seriesWatchLinks}
                onChange={(e) => setSeriesWatchLinks(e.target.value)}
                className="min-h-[84px] font-mono text-sm"
                placeholder="One per line…"
              />
            ) : (
              <Input
                value={movieWatch}
                onChange={(e) => setMovieWatch(e.target.value)}
                className="font-mono text-sm"
                placeholder="Watch link…"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Download</Label>
            {isSeries ? (
              <Textarea
                value={seriesDownloadLinks}
                onChange={(e) => setSeriesDownloadLinks(e.target.value)}
                className="min-h-[84px] font-mono text-sm"
                placeholder="One per line…"
              />
            ) : (
              <Input
                value={movieDownload}
                onChange={(e) => setMovieDownload(e.target.value)}
                className="font-mono text-sm"
                placeholder="Download link…"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
