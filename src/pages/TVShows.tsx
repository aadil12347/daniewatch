import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { getTVGenres, filterAdultContent, getTVDetails, Movie, Genre } from "@/lib/tmdb";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useDbManifest } from "@/hooks/useDbManifest";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminListFilter } from "@/contexts/AdminListFilterContext";
import { mergeDbAndTmdb } from "@/lib/mergeDbAndTmdb";
import { isAllowedOnTvPage } from "@/lib/contentScope";

const INITIAL_BATCH_SIZE = 18;
const LOAD_MORE_BATCH_SIZE = 18;

type DbEntry = {
  id: string;
  type: "movie" | "series";
  genre_ids?: number[] | null;
  release_year?: number | null;
  title?: string | null;
};

const TVShows = () => {
  const [displayShows, setDisplayShows] = useState<Movie[]>([]);
  const [dbOnlyHydrated, setDbOnlyHydrated] = useState<Movie[]>([]);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useMinDurationLoading(600);
  const [pendingInitialLoad, setPendingInitialLoad] = useState(false);
  const [pendingLoadMore, setPendingLoadMore] = useState(false);

  const [hasMore, setHasMore] = useState(true);
  const [endReached, setEndReached] = useState(false);
  // Keep IDs that have already received the append animation (never clear to avoid full-grid "blink")
  const [justAddedIds, setJustAddedIds] = useState<Set<number>>(() => new Set());

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const tmdbPageRef = useRef(1);
  const bufferRef = useRef<Movie[]>([]);
  const loadedIdsRef = useRef<Set<number>>(new Set());
  const isFetchingNextBatchRef = useRef(false);

  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  
  // Use manifest for DB metadata (fast, cached)
  const {
    items: manifestItems,
    metaByKey: manifestMetaByKey,
    availabilityById: manifestAvailabilityById,
    getManifestMetaByKey,
    isLoading: isManifestLoading,
  } = useDbManifest();

  // Fallback to live DB query for admin indicators
  const { getAvailability, isLoading: isAvailabilityLoading } = useEntryAvailability();

  const needsDbLinkedFilter = isAdmin && showOnlyDbLinked;

  // Build DB entries from manifest
  const dbEntriesMatchingFilters = useMemo(() => {
    return manifestItems.filter((item) => {
      if (item.media_type !== "tv") return false;

      const genreIds = item.genre_ids ?? [];
      const year = item.release_year ?? null;

      // Genre filter (overlap)
      if (selectedGenres.length > 0) {
        const hasOverlap = genreIds.some((g) => selectedGenres.includes(g));
        if (!hasOverlap) return false;
      }

      // Year filter
      if (selectedYear) {
        if (selectedYear === "older") {
          if (typeof year !== "number" || year > 2019) return false;
        } else {
          if (typeof year !== "number" || String(year) !== selectedYear) return false;
        }
      }

      return true;
    });
  }, [manifestItems, selectedGenres, selectedYear]);

  const hydrateDbOnlyNow = useCallback(
    async (tmdbKeys: Set<string>, limit: number) => {
      if (manifestMetaByKey.size === 0) return [] as Movie[];

      const candidates = dbEntriesMatchingFilters
        .map((item) => ({ id: item.id, sortYear: item.release_year ?? 0, hasLinks: item.hasWatch || item.hasDownload }))
        .filter((e) => Number.isFinite(e.id))
        .filter((e) => !tmdbKeys.has(`${e.id}-tv`))
        .sort((a, b) => {
          if (a.hasLinks !== b.hasLinks) return a.hasLinks ? -1 : 1;
          return (b.sortYear ?? 0) - (a.sortYear ?? 0);
        });

      const picked = candidates.slice(0, limit);
      if (picked.length === 0) return [] as Movie[];

      const BATCH = 5;
      const results: Movie[] = [];

      for (let i = 0; i < picked.length; i += BATCH) {
        const batch = picked.slice(i, i + BATCH);
        const hydrated = await Promise.all(
          batch.map(async ({ id }) => {
            try {
              const d = await getTVDetails(id);
              return { ...d, media_type: "tv" as const } as Movie;
            } catch {
              return null;
            }
          })
        );

        const cleaned = (hydrated.filter(Boolean) as Movie[]).filter(isAllowedOnTvPage);
        results.push(...(filterAdultContent(cleaned) as Movie[]));
      }

      return results;
    },
    [dbEntriesMatchingFilters, manifestMetaByKey]
  );

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

      const scoped = (filterAdultContent(response.results) as Movie[])
        .map((m) => ({ ...m, media_type: "tv" as const }))
        .filter(isAllowedOnTvPage);

      return {
        page: response.page as number,
        totalPages: response.total_pages as number,
        results: scoped,
      };
    },
    [selectedGenres, selectedYear]
  );

  const isCandidateVisible = useCallback(
    (m: Movie) => {
      if (!m?.id) return false;
      if (!isAllowedOnTvPage(m)) return false;

      // Moderation filter (respects admin visibility rules internally)
      const moderated = filterBlockedPosts([m], "tv");
      if (moderated.length === 0) return false;

      // Optional admin filter: only show entries with at least one link available
      if (!needsDbLinkedFilter) return true;
      const a = getAvailability(m.id);
      return a.hasWatch || a.hasDownload;
    },
    [filterBlockedPosts, getAvailability, needsDbLinkedFilter]
  );

  const gatherNextVisibleItems = useCallback(
    async (targetCount: number) => {
      const batch: Movie[] = [];
      let latestTotalPages: number | null = null;

      while (hasMore && batch.length < targetCount) {
        // Ensure buffer has candidates
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
          const nextHasMore = !noMorePages || bufferRef.current.length > 0;
          setHasMore(nextHasMore);

          if (!nextHasMore) break;
        }

        const next = bufferRef.current.shift();
        if (!next) break;

        if (isCandidateVisible(next)) {
          batch.push(next);
        }

        const noMorePagesNow = latestTotalPages !== null && tmdbPageRef.current > latestTotalPages;
        if (noMorePagesNow && bufferRef.current.length === 0) break;
      }

      return batch;
    },
    [hasMore, isCandidateVisible, requestTmdbPage]
  );

  const resetPaginationState = useCallback(() => {
    setEndReached(false);
    setHasMore(true);
    setJustAddedIds(new Set());

    setDisplayShows([]);
    setDbOnlyHydrated([]);

    bufferRef.current = [];
    loadedIdsRef.current = new Set();
    tmdbPageRef.current = 1;
  }, []);

  // Reset when filters change (NO restoration/cache behavior on this page)
  useEffect(() => {
    setPendingLoadMore(false);
    setPendingInitialLoad(true);
    setIsLoading(true);
    resetPaginationState();
  }, [selectedGenres, selectedYear, resetPaginationState]);

  const canFinalizeVisibility = !isModerationLoading && !isManifestLoading;

  // Initial load: fetch in background and commit ONCE (prevents show-then-filter flashes)
  useEffect(() => {
    if (!pendingInitialLoad) return;
    if (!canFinalizeVisibility) return;
    if (isFetchingNextBatchRef.current) return;

    isFetchingNextBatchRef.current = true;

    void (async () => {
      try {
        const first = await gatherNextVisibleItems(INITIAL_BATCH_SIZE);

        // Pre-hydrate DB-only items before first commit to avoid reorder-jumps.
        const tmdbKeys = new Set(first.map((m) => `${m.id}-tv`));
        const hydrated = await hydrateDbOnlyNow(tmdbKeys, 120);
        setDbOnlyHydrated(hydrated);

        setDisplayShows(first);

        // Initial batch shouldn't use the “just added” animation
        setJustAddedIds(new Set());
      } catch (error) {
        console.error("Failed to fetch TV shows:", error);
        setHasMore(false);
      } finally {
        setPendingInitialLoad(false);
        setIsLoading(false);
        isFetchingNextBatchRef.current = false;
      }
    })();
  }, [canFinalizeVisibility, gatherNextVisibleItems, hydrateDbOnlyNow, pendingInitialLoad]);

  const mergedBase = useMemo(() => {
    return mergeDbAndTmdb({
      tmdbItems: displayShows,
      dbOnlyHydratedItems: dbOnlyHydrated,
      isDbItem: (key) => manifestMetaByKey.has(key),
      getDbMeta: getManifestMetaByKey,
    });
  }, [dbOnlyHydrated, displayShows, getManifestMetaByKey, manifestMetaByKey]);

  const visibleShows = useMemo(() => {
    const base = filterBlockedPosts(mergedBase, "tv");

    return needsDbLinkedFilter
      ? base.filter((it) => {
          // Use manifest availability first (fast), fallback to live query
          const manifestAvail = manifestAvailabilityById.get(it.id);
          if (manifestAvail) {
            return manifestAvail.hasWatch || manifestAvail.hasDownload;
          }
          const a = getAvailability(it.id);
          return a.hasWatch || a.hasDownload;
        })
      : base;
  }, [filterBlockedPosts, getAvailability, mergedBase, needsDbLinkedFilter]);

  // Preload hover images in the background ONLY (never gate the TV grid render on this).
  usePageHoverPreload(visibleShows, { enabled: !isLoading });

  // Only show skeletons before we have any real items to render.
  const pageIsLoading = visibleShows.length === 0 && (isLoading || isModerationLoading || isAvailabilityLoading);

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

  // Tell global loader it can stop as soon as we have real content on screen.
  useEffect(() => {
    if (!pageIsLoading && visibleShows.length > 0) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("route:content-ready")));
    }
  }, [pageIsLoading, visibleShows.length]);

  // Reach-end detector: when user hits the end, show a "Load more" button (no auto-fetch)
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries, observer) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!hasMore) return;
        if (isLoading || isLoadingMore || pendingLoadMore || pendingInitialLoad) return;

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
  }, [hasMore, isLoading, isLoadingMore, pendingInitialLoad, pendingLoadMore]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore) return;
    if (isLoadingMore) return;

    // Do everything in background; commit only once at the end.
    setPendingLoadMore(true);
    setIsLoadingMore(true);
  }, [hasMore, isLoadingMore, setIsLoadingMore]);

  useEffect(() => {
    if (!pendingLoadMore) return;
    if (!canFinalizeVisibility) return;
    if (isFetchingNextBatchRef.current) return;

    isFetchingNextBatchRef.current = true;

    void (async () => {
      try {
        const nextBatch = await gatherNextVisibleItems(LOAD_MORE_BATCH_SIZE);

        if (nextBatch.length > 0) {
          setDisplayShows((prev) => [...prev, ...nextBatch]);

          const ids = new Set(nextBatch.map((b) => b.id));
          setJustAddedIds((prev) => new Set([...prev, ...ids]));
        } else {
          setHasMore(false);
        }

        setEndReached(false);
      } catch (error) {
        console.error("Failed to fetch more TV shows:", error);
      } finally {
        setIsLoadingMore(false);
        setPendingLoadMore(false);
        isFetchingNextBatchRef.current = false;

        // Re-observe after DOM updates so the *new* end must be reached again.
        requestAnimationFrame(() => {
          const el = loadMoreRef.current;
          if (el && observerRef.current && hasMore) observerRef.current.observe(el);
        });
      }
    })();
  }, [canFinalizeVisibility, gatherNextVisibleItems, hasMore, pendingLoadMore, setIsLoadingMore]);

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
          <h1 className="sr-only">TV Shows</h1>

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
                  <div key={`tv-${show.id}`} className={justAddedIds.has(show.id) ? "animate-fly-in" : undefined}>
                    <MovieCard
                      movie={show}
                      animationDelay={Math.min(index * 30, 300)}
                      enableReveal={false}
                      enableHoverPortal={false}
                    />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* No results message */}
          {!pageIsLoading && displayShows.length === 0 && (
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

          {/* Load more area */}
          <div ref={loadMoreRef} className="flex justify-center py-6 min-h-[56px]">
            {isLoadingMore && <InlineDotsLoader ariaLabel="Loading more" />}

            {!isLoadingMore && !hasMore && displayShows.length > 0 && <p className="text-muted-foreground">You've reached the end</p>}

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
