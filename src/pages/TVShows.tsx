import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { getTVGenres, filterAdultContent, Movie, Genre } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminListFilter } from "@/contexts/AdminListFilterContext";

type Slot =
  | { kind: "item"; movie: Movie }
  | { kind: "placeholder"; key: string };

const TVShows = () => {
  const BATCH_SIZE = 10;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useMinDurationLoading(2000);
  // NOTE: `page` tracks the next TMDB "discover" page to request (for cache restore).
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const restoreScrollYRef = useRef<number | null>(null);

  const tmdbPageRef = useRef(1);
  const bufferRef = useRef<Movie[]>([]);
  const loadedIdsRef = useRef<Set<number>>(new Set());
  const isFetchingNextBatchRef = useRef(false);
  const placeholderStartIndexRef = useRef(0);
  const { saveCache, getCache } = useListStateCache<Movie>();
  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  const { getAvailability, isLoading: isAvailabilityLoading } = useEntryAvailability();

  const items = useMemo(
    () => slots.filter((s): s is Extract<Slot, { kind: "item" }> => s.kind === "item").map((s) => s.movie),
    [slots]
  );

  const baseVisible = useMemo(() => filterBlockedPosts(items, "tv"), [filterBlockedPosts, items]);

  // IMPORTANT: Keep order stable to avoid “flashing/jumping”.
  // Only filter (admin) without re-sorting.
  const visibleShows = useMemo(() => {
    return isAdmin && showOnlyDbLinked
      ? baseVisible.filter((s) => {
          const a = getAvailability(s.id);
          return a.hasWatch || a.hasDownload;
        })
      : baseVisible;
  }, [baseVisible, getAvailability, isAdmin, showOnlyDbLinked]);

  const { isLoading: isHoverPreloadLoading } = usePageHoverPreload(visibleShows, { enabled: !isLoading });

  const pageIsLoading = isLoading || isModerationLoading || isHoverPreloadLoading || isAvailabilityLoading;

  // Fetch genres on mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await getTVGenres();
        setGenres(response.genres);
      } catch (error) {
        console.error("Failed to fetch genres:", error);
      }
    };
    fetchGenres();
  }, []);

  // Try to restore from cache on mount.
  // If there is no cache, the filter-change effect will load the first batch.
  useEffect(() => {
    const cached = getCache("default", selectedGenres);
    if (cached && cached.items.length > 0) {
      restoreScrollYRef.current = cached.scrollY ?? 0;
      setSlots(cached.items.map((m) => ({ kind: "item", movie: m })));
      setPage(cached.page);
      tmdbPageRef.current = cached.page;
      bufferRef.current = [];
      loadedIdsRef.current = new Set(cached.items.map((s) => s.id));
      setHasMore(cached.hasMore);
      setIsLoading(false);
      setIsRestoredFromCache(true);
    }
    setIsInitialized(true);
  }, [getCache, selectedGenres]);

  // Restore scroll position after cache is applied
  useEffect(() => {
    if (!isRestoredFromCache) return;
    if (slots.length === 0) return;

    const y = restoreScrollYRef.current;
    if (y === null) return;
    restoreScrollYRef.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      });
    });
  }, [isRestoredFromCache, slots.length]);

  // Save cache before unmount
  useEffect(() => {
    return () => {
      const moviesToCache = slots
        .filter((s): s is Extract<Slot, { kind: "item" }> => s.kind === "item")
        .map((s) => s.movie);

      if (moviesToCache.length > 0) {
        saveCache({
          items: moviesToCache,
          page,
          hasMore,
          activeTab: "default",
          selectedFilters: selectedGenres,
        });
      }
    };
  }, [slots, page, hasMore, selectedGenres, saveCache]);

  const requestTmdbPage = useCallback(
    async (pageNum: number) => {
      const today = new Date().toISOString().split("T")[0];

      const params = new URLSearchParams({
        api_key: "fc6d85b3839330e3458701b975195487",
        include_adult: "false",
        page: pageNum.toString(),
        sort_by: "first_air_date.desc",
        "vote_count.gte": "20",
        "first_air_date.lte": today,
      });

      if (selectedYear) {
        if (selectedYear === "older") {
          params.set("first_air_date.lte", "2019-12-31");
        } else {
          params.set("first_air_date_year", selectedYear);
        }
      }

      if (selectedGenres.length > 0) {
        params.set("with_genres", selectedGenres.join(","));
      }

      const res = await fetch(`https://api.themoviedb.org/3/discover/tv?${params}`);
      const response = await res.json();

      return {
        page: response.page as number,
        totalPages: response.total_pages as number,
        results: filterAdultContent(response.results) as Movie[],
      };
    },
    [selectedGenres, selectedYear]
  );

  const resetAndLoadFirstBatch = useCallback(async () => {
    setIsLoading(true);
    setSlots([]);
    setHasMore(true);

    bufferRef.current = [];
    loadedIdsRef.current = new Set();
    tmdbPageRef.current = 1;
    setPage(1);

    try {
      const { results, totalPages } = await requestTmdbPage(1);

      // Fill the first 10 items; keep the rest buffered so future loads are exactly +10.
      const unique = results.filter((m) => {
        if (!m?.id) return false;
        if (loadedIdsRef.current.has(m.id)) return false;
        loadedIdsRef.current.add(m.id);
        return true;
      });

      const first = unique.slice(0, BATCH_SIZE);
      setSlots(first.map((m) => ({ kind: "item", movie: m })));
      bufferRef.current = unique.slice(BATCH_SIZE);

      tmdbPageRef.current = 2;
      setPage(2);

      // Has more if TMDB has more pages OR we still have buffered items.
      setHasMore(1 < totalPages || bufferRef.current.length > 0);
    } catch (error) {
      console.error("Failed to fetch TV shows:", error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [BATCH_SIZE, requestTmdbPage]);

  const loadNextBatch = useCallback(async () => {
    if (isFetchingNextBatchRef.current) return;
    if (!hasMore) return;
    if (isLoading) return;

    isFetchingNextBatchRef.current = true;
    setIsLoadingMore(true);

    // 1) Add placeholders immediately (reserve space, avoid "flash")
    const placeholderKeys = Array.from({ length: BATCH_SIZE }).map(
      (_, i) => `tv-ph-${Date.now()}-${i}-${Math.random().toString(16).slice(2)}`
    );

    setSlots((prev) => {
      placeholderStartIndexRef.current = prev.length;
      return [...prev, ...placeholderKeys.map((key) => ({ kind: "placeholder", key }) as const)];
    });

    try {
      const batch: Movie[] = [];

      while (batch.length < BATCH_SIZE) {
        if (bufferRef.current.length > 0) {
          const next = bufferRef.current.shift();
          if (next) batch.push(next);
          continue;
        }

        const nextPage = tmdbPageRef.current;
        const { results, totalPages } = await requestTmdbPage(nextPage);

        // Move cursor forward immediately to avoid double-fetching the same page.
        tmdbPageRef.current = nextPage + 1;
        setPage(tmdbPageRef.current);

        const unique = results.filter((m) => {
          if (!m?.id) return false;
          if (loadedIdsRef.current.has(m.id)) return false;
          loadedIdsRef.current.add(m.id);
          return true;
        });

        bufferRef.current.push(...unique);

        // If there are no more pages and the buffer is empty, we’re done.
        const noMorePages = nextPage >= totalPages;
        if (noMorePages && bufferRef.current.length === 0) break;

        setHasMore(!noMorePages || bufferRef.current.length > 0);
      }

      // 2) Replace placeholders IN PLACE with real items (no unmount/mount flash)
      setSlots((prev) => {
        const next = prev.slice();

        for (let i = 0; i < placeholderKeys.length; i++) {
          const idx = placeholderStartIndexRef.current + i;
          const movie = batch[i];

          if (movie) {
            next[idx] = { kind: "item", movie };
          } else {
            // End reached: remove leftover placeholders
            next.splice(idx, 1);
            break;
          }
        }

        return next;
      });

      if (batch.length < BATCH_SIZE && bufferRef.current.length === 0) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to fetch more TV shows:", error);
      // On error: remove placeholders so we don't leave "dead" skeletons.
      setSlots((prev) => prev.filter((s) => s.kind !== "placeholder"));
    } finally {
      setIsLoadingMore(false);
      isFetchingNextBatchRef.current = false;
    }
  }, [BATCH_SIZE, hasMore, isLoading, requestTmdbPage, setIsLoadingMore]);

  // Reset and fetch when filters change
  useEffect(() => {
    if (!isInitialized) return;
    if (isRestoredFromCache) {
      setIsRestoredFromCache(false);
      return;
    }
    resetAndLoadFirstBatch();
  }, [selectedGenres, selectedYear, isInitialized, isRestoredFromCache, resetAndLoadFirstBatch]);

  // Tell global loader it can stop as soon as we have real content on screen.
  useEffect(() => {
    const itemCount = slots.reduce((acc, s) => acc + (s.kind === "item" ? 1 : 0), 0);
    if (!pageIsLoading && itemCount > 0) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("route:content-ready")));
    }
  }, [pageIsLoading, slots]);

  // Infinite scroll observer (loads exactly 10 placeholders, then fills them)
  // IMPORTANT: prevent “auto-chaining” loads by unobserving while a batch is loading.
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries, observer) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        const el = loadMoreRef.current;
        if (!el) return;

        // Stop observing immediately so we only trigger once per “reach the end”.
        observer.unobserve(el);

        void loadNextBatch().finally(() => {
          // Re-observe after the DOM has updated so the new end must be reached again.
          requestAnimationFrame(() => {
            const nextEl = loadMoreRef.current;
            if (nextEl) observer.observe(nextEl);
          });
        });
      },
      {
        // Trigger closer to the actual end (less prefetch → less accidental re-trigger).
        threshold: 0.8,
        rootMargin: "0px 0px 200px 0px",
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loadNextBatch]);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) => (prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]));
  };

  const clearGenres = () => {
    setSelectedGenres([]);
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedYear(null);
  };

  // Convert genres to CategoryNav format
  const genresForNav = useMemo(() => genres.map((g) => ({ id: g.id, name: g.name })), [genres]);

  return (
    <>
      <Helmet>
        <title>TV Shows - DanieWatch</title>
        <meta name="description" content="Browse TV shows sorted by latest release date. Filter by genre and year." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">TV Shows</h1>

          {/* Category Navigation */}
          <div className="mb-8">
            <CategoryNav
              genres={genresForNav}
              selectedGenres={selectedGenres}
              onGenreToggle={toggleGenre}
              onClearGenres={clearGenres}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
            />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {pageIsLoading ? (
              Array.from({ length: 18 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-[2/3] rounded-xl" />
                  <Skeleton className="h-4 w-3/4 mt-3" />
                  <Skeleton className="h-3 w-1/2 mt-2" />
                </div>
              ))
            ) : (
              <>
                {slots.map((slot, index) => {
                  if (slot.kind === "item") {
                    const show = slot.movie;
                    const isVisible = visibleShows.some((s) => s.id === show.id);
                    if (!isVisible) return null;

                    return (
                      <MovieCard
                        key={`tv-slot-${show.id}`}
                        movie={{ ...show, media_type: "tv" }}
                        animationDelay={Math.min(index * 30, 300)}
                      />
                    );
                  }

                  return (
                    <div key={slot.key}>
                      {/* Stable placeholders: no card-reveal and no pulse */}
                      <Skeleton className="aspect-[2/3] rounded-xl animate-none" />
                      <Skeleton className="h-4 w-3/4 mt-3 animate-none" />
                      <Skeleton className="h-3 w-1/2 mt-2 animate-none" />
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* No results message */}
          {!pageIsLoading && items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No TV shows found with the selected filters.</p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Loading More Indicator */}
          <div ref={loadMoreRef} className="flex justify-center py-6 min-h-[56px]">
            {isLoadingMore && <InlineDotsLoader ariaLabel="Loading more" />}
            {!isLoadingMore && !hasMore && items.length > 0 && <p className="text-muted-foreground">You've reached the end</p>}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default TVShows;


