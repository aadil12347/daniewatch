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
        // Strictly "page-contained" for watchlist: search only within watchlist items.
        if (scope === "watchlist") {
          const qq = q.toLowerCase();
          const local = watchlistItems.filter((it) => {
            const title = (it.title || it.name || "").toLowerCase();
            return title.includes(qq);
          });
          if (!cancelled) setResults(local);
          return;
        }

        if (scope === "anime") {
          const res = await searchAnimeScoped(q);
          if (!cancelled) setResults(res.results);
          return;
        }

        if (scope === "korean") {
          const res = await searchKoreanScoped(q);
          if (!cancelled) setResults(res.results);
          return;
        }

        // Movies / TV / Global: merged TMDB search + minimal filter + scope filter.
        const res = await searchMergedGlobal(q);
        let items: Movie[] = (res.results as Movie[]).filter((it) => !it.adult && !BLOCKED_IDS.has(it.id));

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
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? close() : undefined)}>
      <DialogContent
        hideClose
        contentVariant="fullscreenBelowHeader"
        className="p-0 overflow-hidden"
        overlayClassName="bg-background/80"
        // Keep results open when users click around the navbar/header.
        onInteractOutside={(e) => e.preventDefault()}
        // Close results ONLY by clearing the navbar input or browser back.
        onEscapeKeyDown={(e) => e.preventDefault()}
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
