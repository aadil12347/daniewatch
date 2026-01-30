import { useState, useEffect, useCallback } from "react";
import { Search, X, Plus, Pin, Star, Film, Tv } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { useSectionCuration } from "@/hooks/useSectionCuration";
import { searchMulti, getPosterUrl, Movie } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

export function PostSearchPicker() {
  const { pickerOpen, pickerSectionId, pickerSectionTitle, closePicker } = useEditLinksMode();
  const { curatedItems, addToSection, pinToTop } = useSectionCuration(pickerSectionId ?? undefined);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Clear state when modal closes
  useEffect(() => {
    if (!pickerOpen) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
    }
  }, [pickerOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await searchMulti(query);
        const filtered = response.results.filter(
          (item: any) => item.media_type === "movie" || item.media_type === "tv"
        ) as Movie[];
        setResults(filtered.slice(0, 12));
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [query]);

  const isAlreadyInSection = useCallback(
    (tmdbId: number, mediaType: "movie" | "tv") => {
      return curatedItems.some((item) => item.tmdbId === tmdbId && item.mediaType === mediaType);
    },
    [curatedItems]
  );

  const handleAdd = async (movie: Movie) => {
    const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
    const title = movie.title || movie.name || "Unknown";
    const posterPath = movie.poster_path ? getPosterUrl(movie.poster_path, "w185") : null;

    await addToSection(movie.id, mediaType as "movie" | "tv", { title, posterPath });
  };

  const handlePinToTop = async (movie: Movie) => {
    const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
    const title = movie.title || movie.name || "Unknown";
    const posterPath = movie.poster_path ? getPosterUrl(movie.poster_path, "w185") : null;

    await pinToTop(movie.id, mediaType as "movie" | "tv", { title, posterPath });
    closePicker();
  };

  const handleAddAndClose = async (movie: Movie) => {
    await handleAdd(movie);
    closePicker();
  };

  const getYear = (movie: Movie) => {
    const date = movie.release_date || movie.first_air_date;
    return date ? date.slice(0, 4) : null;
  };

  return (
    <Dialog open={pickerOpen} onOpenChange={(open) => !open && closePicker()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add to "{pickerSectionTitle}"
          </DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search movies or TV shows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-sm"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-[300px] -mx-6 px-6">
          {isSearching ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-2">
                  <Skeleton className="w-16 h-24 rounded-md flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2 py-2">
              {results.map((movie) => {
                const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
                const alreadyAdded = isAlreadyInSection(movie.id, mediaType as "movie" | "tv");
                const title = movie.title || movie.name || "Unknown";
                const year = getYear(movie);
                const rating = movie.vote_average?.toFixed(1);
                const posterUrl = movie.poster_path ? getPosterUrl(movie.poster_path, "w185") : null;

                return (
                  <div
                    key={`${movie.id}-${mediaType}`}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg border transition-colors",
                      alreadyAdded ? "bg-muted/30 border-muted" : "hover:bg-muted/50 border-transparent"
                    )}
                  >
                    {/* Poster */}
                    <div className="w-12 h-18 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                      {posterUrl ? (
                        <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No Image
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {year && <span>{year}</span>}
                        {rating && rating !== "0.0" && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            {rating}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                          {mediaType === "movie" ? (
                            <>
                              <Film className="w-2.5 h-2.5" />
                              Movie
                            </>
                          ) : (
                            <>
                              <Tv className="w-2.5 h-2.5" />
                              TV
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {alreadyAdded ? (
                        <Badge variant="secondary" className="text-xs">
                          Added
                        </Badge>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleAddAndClose(movie)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => handlePinToTop(movie)}
                          >
                            <Pin className="w-3.5 h-3.5" />
                            Pin
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : query.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm">Search for movies or TV shows to add</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
