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
import { groupDbLinkedFirst } from "@/lib/sortContent";

const TVShows = () => {
  const BATCH_SIZE = 10;

  const [shows, setShows] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useMinDurationLoading(2000);
  // NOTE: `page` now tracks the next TMDB "discover" page to request (for cache restore).
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const [pendingPlaceholders, setPendingPlaceholders] = useState(0);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const restoreScrollYRef = useRef<number | null>(null);

  const tmdbPageRef = useRef(1);
  const bufferRef = useRef<Movie[]>([]);
  const loadedIdsRef = useRef<Set<number>>(new Set());
  const isFetchingNextBatchRef = useRef(false);
  const { saveCache, getCache } = useListStateCache<Movie>();
  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  const { getAvailability, isLoading: isAvailabilityLoading } = useEntryAvailability();

  const baseVisible = useMemo(() => filterBlockedPosts(shows, "tv"), [filterBlockedPosts, shows]);

  const visibleShows = useMemo(() => {
    const sorted = isAvailabilityLoading
      ? baseVisible
      : groupDbLinkedFirst(baseVisible, (s) => {
          const a = getAvailability(s.id);
          return a.hasWatch || a.hasDownload;
        });

    return isAdmin && showOnlyDbLinked
      ? sorted.filter((s) => {
          const a = getAvailability(s.id);
          return a.hasWatch || a.hasDownload;
        })
      : sorted;
  }, [baseVisible, getAvailability, isAdmin, isAvailabilityLoading, showOnlyDbLinked]);

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
      setShows(cached.items);
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
    if (shows.length === 0) return;

    const y = restoreScrollYRef.current;
    if (y === null) return;
    restoreScrollYRef.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      });
    });
  }, [isRestoredFromCache, shows.length]);

  // Save cache before unmount
  useEffect(() => {
    return () => {
      if (shows.length > 0) {
        saveCache({
          items: shows,
          page,
          hasMore,
          activeTab: "default",
          selectedFilters: selectedGenres,
        });
      }
    };
  }, [shows, page, hasMore, selectedGenres, saveCache]);

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
    setShows([]);
    setHasMore(true);
    setPendingPlaceholders(0);

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

      setShows(unique.slice(0, BATCH_SIZE));
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
    setPendingPlaceholders(BATCH_SIZE);
    setIsLoadingMore(true);

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

      if (batch.length > 0) {
        setShows((prev) => [...prev, ...batch]);
      }

      if (batch.length < BATCH_SIZE && bufferRef.current.length === 0) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to fetch more TV shows:", error);
      // Keep hasMore as-is; user can scroll again to retry.
    } finally {
      setPendingPlaceholders(0);
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
    if (!pageIsLoading && shows.length > 0) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("route:content-ready")));
    }
  }, [pageIsLoading, shows.length]);

  // Infinite scroll observer (loads exactly 10 placeholders, then fills them)
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        loadNextBatch();
      },
      {
        threshold: 0.1,
        rootMargin: "800px 0px 800px 0px",
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
                {visibleShows.map((show, index) => (
                  <MovieCard
                    key={`${show.id}-tv`}
                    movie={{ ...show, media_type: "tv" }}
                    animationDelay={Math.min(index * 30, 300)}
                  />
                ))}

                {/* While fetching the next batch, render 10 mock cards (then fill them) */}
                {Array.from({ length: pendingPlaceholders }).map((_, i) => (
                  <div
                    key={`tv-ph-${shows.length}-${i}`}
                    className="card-reveal"
                    style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                  >
                    <Skeleton className="aspect-[2/3] rounded-xl" />
                    <Skeleton className="h-4 w-3/4 mt-3" />
                    <Skeleton className="h-3 w-1/2 mt-2" />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* No results message */}
          {!pageIsLoading && shows.length === 0 && (
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
            {!isLoadingMore && !hasMore && shows.length > 0 && <p className="text-muted-foreground">You've reached the end</p>}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default TVShows;


