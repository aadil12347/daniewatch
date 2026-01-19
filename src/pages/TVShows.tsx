import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { getTVGenres, filterAdultContent, Movie, Genre } from "@/lib/tmdb";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminListFilter } from "@/contexts/AdminListFilterContext";

const TVShows = () => {
  const BATCH_SIZE = 10;

  const [shows, setShows] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useMinDurationLoading(600);
  const [hasMore, setHasMore] = useState(true);
  const [endReached, setEndReached] = useState(false);
  const [pendingLoadMore, setPendingLoadMore] = useState(false);
  const [justAddedIds, setJustAddedIds] = useState<Set<number>>(() => new Set());

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const justAddedTimerRef = useRef<number | null>(null);

  const tmdbPageRef = useRef(1);
  const bufferRef = useRef<Movie[]>([]);
  const loadedIdsRef = useRef<Set<number>>(new Set());
  const isFetchingNextBatchRef = useRef(false);

  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  const { getAvailability, isLoading: isAvailabilityLoading } = useEntryAvailability();

  const needsDbLinkedFilter = isAdmin && showOnlyDbLinked;
  const canFinalizeVisibility = !isModerationLoading && (!needsDbLinkedFilter || !isAvailabilityLoading);

  const baseVisible = useMemo(() => filterBlockedPosts(shows, "tv"), [filterBlockedPosts, shows]);

  // IMPORTANT: Keep order stable to avoid “flashing/jumping”.
  // Only filter (admin) without re-sorting.
  const visibleShows = useMemo(() => {
    return needsDbLinkedFilter
      ? baseVisible.filter((s) => {
          const a = getAvailability(s.id);
          return a.hasWatch || a.hasDownload;
        })
      : baseVisible;
  }, [baseVisible, getAvailability, needsDbLinkedFilter]);

  const visibleIdSet = useMemo(() => new Set(visibleShows.map((s) => s.id)), [visibleShows]);

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

  useEffect(() => {
    return () => {
      if (justAddedTimerRef.current) window.clearTimeout(justAddedTimerRef.current);
    };
  }, []);

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
    setEndReached(false);

    setShows([]);
    setHasMore(true);

    bufferRef.current = [];
    loadedIdsRef.current = new Set();
    tmdbPageRef.current = 1;

    try {
      const { results, totalPages } = await requestTmdbPage(1);

      const unique = results.filter((m) => {
        if (!m?.id) return false;
        if (loadedIdsRef.current.has(m.id)) return false;
        loadedIdsRef.current.add(m.id);
        return true;
      });

      const first = unique.slice(0, BATCH_SIZE);
      setShows(first);
      bufferRef.current = unique.slice(BATCH_SIZE);

      tmdbPageRef.current = 2;

      // Has more if TMDB has more pages OR we still have buffered items.
      setHasMore(1 < totalPages || bufferRef.current.length > 0);

      // Animate initial reveal once (optional): treat first batch as not "just added"
      setJustAddedIds(new Set());
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
    if (!canFinalizeVisibility) return;

    isFetchingNextBatchRef.current = true;
    setIsLoadingMore(true);

    try {
      const candidates: Movie[] = [];
      let latestTotalPages: number | null = null;

      const filterCandidatesToVisible = (arr: Movie[]) => {
        const moderationFiltered = filterBlockedPosts(arr, "tv");
        if (!needsDbLinkedFilter) return moderationFiltered;
        return moderationFiltered.filter((m) => {
          const a = getAvailability(m.id);
          return a.hasWatch || a.hasDownload;
        });
      };

      let visibleBatch: Movie[] = [];

      // Keep gathering until we have 10 *visible* items (blocked/unavailable are not counted)
      while (hasMore && visibleBatch.length < BATCH_SIZE) {
        // Pull from buffer first
        while (bufferRef.current.length > 0 && candidates.length < BATCH_SIZE * 6) {
          const next = bufferRef.current.shift();
          if (next) candidates.push(next);
          visibleBatch = filterCandidatesToVisible(candidates).slice(0, BATCH_SIZE);
          if (visibleBatch.length >= BATCH_SIZE) break;
        }

        if (visibleBatch.length >= BATCH_SIZE) break;

        // If buffer is empty, fetch a new TMDB page
        if (bufferRef.current.length === 0) {
          const nextPage = tmdbPageRef.current;
          const { results, totalPages } = await requestTmdbPage(nextPage);
          latestTotalPages = totalPages;

          tmdbPageRef.current = nextPage + 1;

          const unique = results.filter((m) => {
            if (!m?.id) return false;
            if (loadedIdsRef.current.has(m.id)) return false;
            loadedIdsRef.current.add(m.id);
            return true;
          });

          bufferRef.current.push(...unique);

          const noMorePages = nextPage >= totalPages;
          setHasMore(!noMorePages || bufferRef.current.length > 0);
          if (noMorePages && bufferRef.current.length === 0) break;
        } else {
          // Buffer has items but we couldn't reach 10 visible due to filtering; loop will continue
          visibleBatch = filterCandidatesToVisible(candidates).slice(0, BATCH_SIZE);
          if (visibleBatch.length >= BATCH_SIZE) break;
        }

        // Stop if we’re clearly out of content
        const noMorePagesNow = latestTotalPages !== null && tmdbPageRef.current > latestTotalPages;
        if (noMorePagesNow && bufferRef.current.length === 0) break;
      }

      if (visibleBatch.length > 0) {
        setShows((prev) => [...prev, ...visibleBatch]);

        // Smooth append animation for the new batch (no card-reveal flash)
        const ids = new Set(visibleBatch.map((b) => b.id));
        setJustAddedIds(ids);
        if (justAddedTimerRef.current) window.clearTimeout(justAddedTimerRef.current);
        justAddedTimerRef.current = window.setTimeout(() => setJustAddedIds(new Set()), 520);
      }

      // If we couldn't produce a full visible batch and there’s nothing left buffered, we’re done.
      if (visibleBatch.length < BATCH_SIZE && bufferRef.current.length === 0 && latestTotalPages !== null && tmdbPageRef.current > latestTotalPages) {
        setHasMore(false);
      }

      setEndReached(false);
    } catch (error) {
      console.error("Failed to fetch more TV shows:", error);
    } finally {
      setIsLoadingMore(false);
      isFetchingNextBatchRef.current = false;
    }
  }, [BATCH_SIZE, canFinalizeVisibility, filterBlockedPosts, getAvailability, hasMore, isLoading, needsDbLinkedFilter, requestTmdbPage, setIsLoadingMore]);

  // Fetch when filters change (NO restoration/cache behavior on this page)
  useEffect(() => {
    setPendingLoadMore(false);
    resetAndLoadFirstBatch();
  }, [selectedGenres, selectedYear, resetAndLoadFirstBatch]);

  // Tell global loader it can stop as soon as we have real content on screen.
  useEffect(() => {
    if (!pageIsLoading && shows.length > 0) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("route:content-ready")));
    }
  }, [pageIsLoading, shows.length]);

  // Reach-end detector: when user hits the end, show a "Load more" button (no auto-fetch)
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries, observer) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!hasMore) return;
        if (isLoading || isLoadingMore || pendingLoadMore) return;

        const el = loadMoreRef.current;
        if (!el) return;

        // Arm the button once per "end".
        setEndReached(true);
        observer.unobserve(el);
      },
      {
        threshold: 0.8,
        rootMargin: "0px 0px 200px 0px",
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading, isLoadingMore, pendingLoadMore]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore) return;
    if (isLoadingMore) return;

    // Don't append anything until moderation/availability filters are ready.
    // We keep the loader visible while waiting so there are no "add then remove" flashes.
    setPendingLoadMore(true);
    setIsLoadingMore(true);
  }, [hasMore, isLoadingMore, setIsLoadingMore]);

  useEffect(() => {
    if (!pendingLoadMore) return;
    if (!canFinalizeVisibility) return;

    void loadNextBatch().finally(() => {
      setPendingLoadMore(false);

      // Re-observe after DOM updates so the *new* end must be reached again.
      requestAnimationFrame(() => {
        const el = loadMoreRef.current;
        if (el && observerRef.current && hasMore) observerRef.current.observe(el);
      });
    });
  }, [pendingLoadMore, canFinalizeVisibility, loadNextBatch, hasMore]);

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
                  <Skeleton className="aspect-[2/3] rounded-xl animate-none" />
                  <Skeleton className="h-4 w-3/4 mt-3 animate-none" />
                  <Skeleton className="h-3 w-1/2 mt-2 animate-none" />
                </div>
              ))
            ) : (
              <>
                {visibleShows.map((show, index) => (
                  <MovieCard
                    key={`tv-${show.id}`}
                    movie={{ ...show, media_type: "tv" }}
                    animationDelay={Math.min(index * 30, 300)}
                    className={justAddedIds.has(show.id) ? "tv-element-in" : undefined}
                  />
                ))}
              </>
            )}
          </div>

          {/* No results message */}
          {!pageIsLoading && shows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No TV shows found with the selected filters.</p>
              <button onClick={clearFilters} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-colors">
                Clear filters
              </button>
            </div>
          )}

          {/* Load more area */}
          <div ref={loadMoreRef} className="flex justify-center py-6 min-h-[56px]">
            {isLoadingMore && <InlineDotsLoader ariaLabel="Loading more" />}

            {!isLoadingMore && !hasMore && shows.length > 0 && <p className="text-muted-foreground">You've reached the end</p>}

            {!isLoadingMore && hasMore && endReached && (
              <button
                type="button"
                onClick={handleLoadMore}
                className="px-5 py-2 rounded-full bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default TVShows;


