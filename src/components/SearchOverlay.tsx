import React from "react";
import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BLOCKED_IDS, searchAnimeScoped, searchKoreanScoped, searchMergedGlobal, type Movie } from "@/lib/tmdb";
import { isAllowedOnMoviesPage, isAllowedOnTvPage } from "@/lib/contentScope";
import { useSearchOverlay } from "@/contexts/SearchOverlayContext";
import { useWatchlist } from "@/hooks/useWatchlist";
import { MovieCard } from "@/components/MovieCard";

export const SearchOverlay = () => {
  const { isOpen, query, scope, close } = useSearchOverlay();
  const { getWatchlistAsMovies } = useWatchlist();

  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Movie[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [isOpen, query]);

  const watchlistItems = useMemo(() => getWatchlistAsMovies(), [getWatchlistAsMovies]);

  useEffect(() => {
    if (!isOpen) return;

    const q = debouncedQuery.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        let items: Movie[] = [];

        if (scope === "watchlist") {
          // Strictly "page-contained" for watchlist: search only within watchlist items.
          const qq = q.toLowerCase();
          items = watchlistItems.filter((it) => {
            const title = (it.title || it.name || "").toLowerCase();
            return title.includes(qq);
          });
        } else if (scope === "anime") {
          const res = await searchAnimeScoped(q);
          items = res.results;
        } else if (scope === "korean") {
          const res = await searchKoreanScoped(q);
          items = res.results;
        } else {
          // Movies / TV / Global: merged TMDB search + minimal filter + scope filter.
          const res = await searchMergedGlobal(q);
          items = (res.results as Movie[]).filter((it) => !it.adult && !BLOCKED_IDS.has(it.id));

          if (scope === "movies") {
            items = items.filter((it) => isAllowedOnMoviesPage({ media_type: (it.media_type as any) ?? "movie" }));
          } else if (scope === "tv") {
            items = items.filter((it) =>
              isAllowedOnTvPage({
                media_type: (it.media_type as any) ?? (it.first_air_date ? "tv" : undefined),
                first_air_date: it.first_air_date,
              })
            );
          }
        }

        if (!cancelled) setResults(items);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isOpen, scope, watchlistItems]);

  return (
    <Dialog open={isOpen} modal={false} onOpenChange={() => {}}>
      <DialogContent
        hideClose
        contentVariant="fullscreenBelowHeader"
        className="p-0 overflow-hidden"
        overlayClassName="bg-background/80"
      >
        <div className="h-full w-full flex flex-col">
          <div className="flex-1 overflow-auto p-4">
            {error && <div className="text-sm text-destructive">{error}</div>}

            {!error && !loading && debouncedQuery && results.length === 0 && (
              <div className="text-sm text-muted-foreground">No results.</div>
            )}

            {!error && results.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.map((item) => (
                  <MovieCard key={`${item.id}-${item.media_type ?? "movie"}`} movie={item} />
                ))}
              </div>
            )}

            {loading && (
              <div className="text-sm text-muted-foreground">Searching…</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
