import { useCallback, useMemo, useRef, useState } from "react";
import { Ban, Loader2, Search, ShieldOff, Shield, Film, Tv } from "lucide-react";

import { usePostModeration } from "@/hooks/usePostModeration";
import { useToast } from "@/hooks/use-toast";
import { getImageUrl, getMovieDetails, getTVDetails } from "@/lib/tmdb";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MediaChoice = "movie" | "tv";

type TMDBChoice = {
  tmdbId: string;
  mediaType: MediaChoice;
  title: string;
  posterPath: string | null;
  year: string | null;
};

export function BlockedPostsPanel() {
  const { toast } = useToast();
  const { getBlockedPosts, blockPost, unblockPost, isBlocked } = usePostModeration();

  const blockedPosts = getBlockedPosts();

  // Search state
  const [tmdbId, setTmdbId] = useState("");
  const [mediaType, setMediaType] = useState<MediaChoice>("tv");
  const [seasonNumber, setSeasonNumber] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<{ movie: TMDBChoice | null; tv: TMDBChoice | null }>({
    movie: null,
    tv: null,
  });

  const activeChoice: TMDBChoice | null = useMemo(() => {
    return mediaType === "movie" ? candidates.movie : candidates.tv;
  }, [candidates.movie, candidates.tv, mediaType]);

  const isActiveBlocked = useMemo(() => {
    if (!activeChoice) return false;
    return isBlocked(activeChoice.tmdbId, activeChoice.mediaType);
  }, [activeChoice, isBlocked]);

  const handleSearch = useCallback(async () => {
    const id = tmdbId.trim();
    if (!id) return;

    setIsSearching(true);
    setSearchError(null);
    setCandidates({ movie: null, tv: null });

    try {
      const [movieResult, tvResult] = await Promise.allSettled([getMovieDetails(Number(id)), getTVDetails(Number(id))]);

      let movieCandidate: TMDBChoice | null = null;
      let tvCandidate: TMDBChoice | null = null;

      if (movieResult.status === "fulfilled" && movieResult.value?.title) {
        const movie = movieResult.value;
        movieCandidate = {
          tmdbId: String(movie.id),
          mediaType: "movie",
          title: movie.title,
          posterPath: movie.poster_path ?? null,
          year: movie.release_date?.split("-")[0] ?? null,
        };
      }

      if (tvResult.status === "fulfilled" && tvResult.value?.name) {
        const show = tvResult.value;
        tvCandidate = {
          tmdbId: String(show.id),
          mediaType: "tv",
          title: show.name ?? "Unknown",
          posterPath: show.poster_path ?? null,
          year: show.first_air_date?.split("-")[0] ?? null,
        };
      }

      setCandidates({ movie: movieCandidate, tv: tvCandidate });

      const hasAny = Boolean(movieCandidate || tvCandidate);
      if (!hasAny) throw new Error("Not found");

      // Auto pick a sensible type if current selection isn't available
      if (mediaType === "movie" && !movieCandidate && tvCandidate) setMediaType("tv");
      if (mediaType === "tv" && !tvCandidate && movieCandidate) setMediaType("movie");
    } catch (e) {
      console.error("Blocked post search error:", e);
      setSearchError("Failed to find content with this TMDB ID. Please check the ID and try again.");
    } finally {
      setIsSearching(false);
    }
  }, [mediaType, tmdbId]);

  const handleBlockToggle = useCallback(async () => {
    if (!activeChoice) return;

    const suffix = activeChoice.mediaType === "tv" && seasonNumber.trim() ? ` — Season ${seasonNumber.trim()}` : "";
    const labelTitle = `${activeChoice.title}${suffix}`;

    try {
      if (isActiveBlocked) {
        await unblockPost(activeChoice.tmdbId, activeChoice.mediaType);
        toast({ title: "Unblocked", description: labelTitle });
      } else {
        await blockPost(activeChoice.tmdbId, activeChoice.mediaType, labelTitle, activeChoice.posterPath ?? undefined);
        toast({ title: "Blocked", description: labelTitle });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message ?? "Operation failed.",
        variant: "destructive",
      });
    }
  }, [activeChoice, blockPost, isActiveBlocked, seasonNumber, toast, unblockPost]);

  const listFilterInputRef = useRef<HTMLInputElement | null>(null);
  const [listFilter, setListFilter] = useState("");

  const filteredBlockedPosts = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return blockedPosts;
    return blockedPosts.filter((p) => {
      const title = (p.title ?? "").toLowerCase();
      const id = String(p.tmdb_id);
      const type = p.media_type;
      return title.includes(q) || id.includes(q) || type.includes(q);
    });
  }, [blockedPosts, listFilter]);

  return (
    <div className="space-y-6">
      {/* Search / manual block */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Search & Block / Unblock</CardTitle>
          <CardDescription>Search by TMDB ID, then block or unblock the movie/TV show.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={mediaType} onValueChange={(v) => setMediaType(v as MediaChoice)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="movie">
                    <span className="inline-flex items-center gap-2"><Film className="h-4 w-4" /> Movie</span>
                  </SelectItem>
                  <SelectItem value="tv">
                    <span className="inline-flex items-center gap-2"><Tv className="h-4 w-4" /> TV Show</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Season (optional)</Label>
              <Input
                placeholder={mediaType === "tv" ? "e.g., 2" : "N/A for movies"}
                value={seasonNumber}
                onChange={(e) => setSeasonNumber(e.target.value.replace(/[^0-9]/g, ""))}
                disabled={mediaType !== "tv"}
              />
            </div>
          </div>

          {searchError && <p className="text-sm text-destructive">{searchError}</p>}

          {/* Candidate switch + result */}
          {(candidates.movie || candidates.tv) && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                If the TMDB ID exists as both a movie and a TV show, pick the right one.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={mediaType === "movie" ? "default" : "outline"}
                  disabled={!candidates.movie}
                  onClick={() => setMediaType("movie")}
                >
                  <Film className="h-4 w-4 mr-2" /> Movie
                </Button>
                <Button
                  type="button"
                  variant={mediaType === "tv" ? "default" : "outline"}
                  disabled={!candidates.tv}
                  onClick={() => setMediaType("tv")}
                >
                  <Tv className="h-4 w-4 mr-2" /> TV
                </Button>
              </div>

              {activeChoice && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex gap-4 items-center">
                      {activeChoice.posterPath ? (
                        <img
                          src={getImageUrl(activeChoice.posterPath, "w92")}
                          alt={activeChoice.title}
                          className="w-16 h-24 object-cover rounded-lg"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 h-24 bg-secondary rounded-lg flex items-center justify-center">
                          <Ban className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1">
                        <h3 className="font-semibold">
                          {activeChoice.title}
                          {activeChoice.year ? <span className="text-muted-foreground"> ({activeChoice.year})</span> : null}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          TMDB: {activeChoice.tmdbId} · <span className="capitalize">{activeChoice.mediaType}</span>
                          {activeChoice.mediaType === "tv" && seasonNumber.trim() ? ` · Season ${seasonNumber.trim()}` : ""}
                        </p>
                        {activeChoice.mediaType === "tv" && seasonNumber.trim() ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Note: blocking applies to the whole show; season is saved as a label for admins.
                          </p>
                        ) : null}
                      </div>

                      <Button
                        variant={isActiveBlocked ? "outline" : "default"}
                        size="sm"
                        onClick={handleBlockToggle}
                        className="gap-1"
                      >
                        {isActiveBlocked ? (
                          <>
                            <ShieldOff className="w-4 h-4" /> Unblock
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4" /> Block
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current blocked list */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Blocked posts</h2>
            <p className="text-sm text-muted-foreground">{blockedPosts.length} total</p>
          </div>

          {blockedPosts.length > 0 && (
            <div className="w-full sm:w-[320px]">
              <Input
                ref={(el) => {
                  listFilterInputRef.current = el;
                }}
                placeholder="Filter by title, id, type..."
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value)}
              />
            </div>
          )}
        </div>

        {blockedPosts.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Ban className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No blocked posts</h3>
              <p className="text-muted-foreground">Posts you block will appear here.</p>
            </CardContent>
          </Card>
        ) : filteredBlockedPosts.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Ban className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No matches</h3>
              <p className="text-muted-foreground">Try a different search term.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBlockedPosts.map((post) => (
              <Card key={`${post.tmdb_id}-${post.media_type}`}>
                <CardContent className="pt-6">
                  <div className="flex gap-4 items-center">
                    {post.poster_path ? (
                      <img
                        src={getImageUrl(post.poster_path, "w92")}
                        alt={post.title || "Post"}
                        className="w-16 h-24 object-cover rounded-lg"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-16 h-24 bg-secondary rounded-lg flex items-center justify-center">
                        <Ban className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold">{post.title || `ID: ${post.tmdb_id}`}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {post.media_type} · TMDB {post.tmdb_id}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblockPost(post.tmdb_id, post.media_type)}
                      className="gap-1"
                    >
                      <ShieldOff className="w-4 h-4" /> Unblock
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
