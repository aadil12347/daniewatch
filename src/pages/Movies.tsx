import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { getMovieGenres, filterAdultContent, getMovieDetails, Movie, Genre } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { usePostModeration } from "@/hooks/usePostModeration";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminListFilter } from "@/contexts/AdminListFilterContext";
import { mergeDbAndTmdb } from "@/lib/mergeDbAndTmdb";
import { isAllowedOnMoviesPage } from "@/lib/contentScope";

const BATCH_SIZE = 18;

type DbEntry = {
  id: string;
  type: "movie" | "series";
  genre_ids?: number[] | null;
  release_year?: number | null;
  title?: string | null;
};

const Movies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [dbOnlyHydrated, setDbOnlyHydrated] = useState<Movie[]>([]);

  const [displayCount, setDisplayCount] = useState(0);
  const [animateFromIndex, setAnimateFromIndex] = useState<number | null>(null);
  const [pendingLoadMore, setPendingLoadMore] = useState(false);
  const loadMoreFetchRequestedRef = useRef(false);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useMinDurationLoading(600);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const restoreScrollYRef = useRef<number | null>(null);

  const dbHydrationCursorRef = useRef(0);

  const { saveCache, getCache } = useListStateCache<Movie>();
  const { filterBlockedPosts, sortWithPinnedFirst, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  const {
    entries: dbEntries,
    metaByKey,
    getDbMetaByKey,
    getAvailability,
    isLoading: isAvailabilityLoading,
  } = useEntryAvailability();

  const getKey = useCallback((m: Pick<Movie, "id" | "media_type" | "first_air_date">) => {
    const media = (m.media_type as "movie" | "tv" | undefined) ?? (m.first_air_date ? "tv" : "movie");
    return `${m.id}-${media}`;
  }, []);

  const dbEntriesMatchingFilters = useMemo(() => {
    return normalizedDbEntries.filter((e) => {
      if (e.type !== "movie") return false;

      const genreIds = e.genre_ids ?? [];
      const year = e.release_year ?? null;

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
  }, [normalizedDbEntries, selectedGenres, selectedYear]);

  const dbCandidates = useMemo(() => {
    const out: Array<{ id: number; mediaType: "movie"; sortYear: number }> = [];

    for (const e of dbEntriesMatchingFilters) {
      const id = Number(e.id);
      if (!Number.isFinite(id)) continue;

      const key = `${id}-movie`;
      const meta = metaByKey.get(key);
      if (!meta) continue;

      // Enforce Movies-page scope using DB metadata (avoid hydrating off-scope entries).
      const lang = meta.originalLanguage ?? null;
      const genreIds = meta.genreIds ?? [];
      const origin = meta.originCountry ?? [];

      const isAnime = lang === "ja" && genreIds.includes(16);
      const isIndian = ["hi", "ta", "te"].includes(lang ?? "");
      const isKorean = ["ko", "zh", "tr"].includes(lang ?? "") || origin.some((c) => ["KR", "CN", "TW", "HK", "TR"].includes(c));

      if (isAnime || isIndian || isKorean) continue;

      const sortYear = (typeof e.release_year === "number" && Number.isFinite(e.release_year) ? e.release_year : null) ??
        (typeof meta.releaseYear === "number" && Number.isFinite(meta.releaseYear) ? meta.releaseYear : null) ??
        0;

      out.push({ id, mediaType: "movie", sortYear });
    }

    out.sort((a, b) => b.sortYear - a.sortYear);
    return out;
  }, [dbEntriesMatchingFilters, metaByKey]);

  const hydrateDbOnly = useCallback(
    async (tmdbKeys: Set<string>, limit: number) => {
      if (metaByKey.size === 0) return;

      const hydratedKeys = new Set(dbOnlyHydrated.map((m) => getKey(m)));
      const toHydrate: Array<{ id: number }> = [];

      let cursor = dbHydrationCursorRef.current;
      while (cursor < dbCandidates.length && toHydrate.length < limit) {
        const c = dbCandidates[cursor];
        cursor += 1;

        const key = `${c.id}-movie`;
        if (tmdbKeys.has(key)) continue;
        if (hydratedKeys.has(key)) continue;

        toHydrate.push({ id: c.id });
      }
      dbHydrationCursorRef.current = cursor;

      if (toHydrate.length === 0) return;

      const BATCH = 5;
      const results: Movie[] = [];

      for (let i = 0; i < toHydrate.length; i += BATCH) {
        const batch = toHydrate.slice(i, i + BATCH);
        const hydrated = await Promise.all(
          batch.map(async ({ id }) => {
            try {
              const d = await getMovieDetails(id);
              return { ...d, media_type: "movie" as const } as Movie;
            } catch {
              return null;
            }
          })
        );

        const cleaned = (hydrated.filter(Boolean) as Movie[]).filter(isAllowedOnMoviesPage);
        results.push(...(filterAdultContent(cleaned) as Movie[]));
      }

      if (results.length > 0) {
        setDbOnlyHydrated((prev) => {
          const seen = new Set(prev.map((m) => getKey(m)));
          const next = [...prev];
          for (const m of results) {
            const k = getKey(m);
            if (seen.has(k)) continue;
            seen.add(k);
            next.push(m);
          }
          return next;
        });
      }
    },
    [dbCandidates, dbOnlyHydrated, getKey, metaByKey.size]
  );

  const mergedBase = useMemo(() => {
    return mergeDbAndTmdb({
      tmdbItems: movies,
      dbOnlyHydratedItems: dbOnlyHydrated,
      isDbItem: (key) => metaByKey.has(key),
      getDbMeta: getDbMetaByKey,
    });
  }, [dbOnlyHydrated, getDbMetaByKey, movies, metaByKey]);

  const baseVisible = useMemo(() => filterBlockedPosts(mergedBase, "movie"), [filterBlockedPosts, mergedBase]);

  const visibleMovies = useMemo(() => {
    // Keep DB-first grouping intact; apply pinned ordering within each group.
    const isDb = (m: Movie) => metaByKey.has(`${m.id}-movie`);

    const dbGroup = baseVisible.filter(isDb);
    const tmdbGroup = baseVisible.filter((m) => !isDb(m));

    const dbSorted = sortWithPinnedFirst(dbGroup, "movies", "movie");
    const tmdbSorted = sortWithPinnedFirst(tmdbGroup, "movies", "movie");

    const combined = [...dbSorted, ...tmdbSorted];

    if (isAdmin && showOnlyDbLinked) {
      return combined.filter((m) => {
        const a = getAvailability(m.id);
        return a.hasWatch || a.hasDownload;
      });
    }

    return combined;
  }, [baseVisible, getAvailability, isAdmin, metaByKey, showOnlyDbLinked, sortWithPinnedFirst]);

  // Preload hover images in the background ONLY (never gate the grid render on this).
  usePageHoverPreload(visibleMovies, { enabled: !isLoading });

  // Only show skeletons before we have any real items to render.
  const pageIsLoading = displayCount === 0 && (isLoading || isModerationLoading || isAvailabilityLoading);

  // Fetch genres on mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await getMovieGenres();
        setGenres(response.genres);
      } catch (error) {
        console.error("Failed to fetch genres:", error);
      }
    };
    fetchGenres();
  }, []);

  // Try to restore from cache on mount
  useEffect(() => {
    const cached = getCache("default", selectedGenres);
    if (cached && cached.items.length > 0) {
      restoreScrollYRef.current = cached.scrollY ?? 0;
      setMovies(cached.items);
      setDisplayCount(cached.items.length);
      setAnimateFromIndex(null);
      setPage(cached.page);
      setHasMore(cached.hasMore);
      setIsLoading(false);
      setIsRestoredFromCache(true);
    }
    setIsInitialized(true);
  }, []);

  // Restore scroll position after cache is applied
  useEffect(() => {
    if (!isRestoredFromCache) return;
    if (movies.length === 0) return;

    const y = restoreScrollYRef.current;
    if (y === null) return;
    restoreScrollYRef.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      });
    });
  }, [isRestoredFromCache, movies.length]);

  // Save cache before unmount
  useEffect(() => {
    return () => {
      if (movies.length > 0) {
        saveCache({
          items: movies,
          page,
          hasMore,
          activeTab: "default",
          selectedFilters: selectedGenres,
        });
      }
    };
  }, [movies, page, hasMore, selectedGenres, saveCache]);

  const fetchMovies = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (reset) {
        setIsLoading(true);
        setDbOnlyHydrated([]);
        dbHydrationCursorRef.current = 0;
      } else {
        setIsLoadingMore(true);
      }

      const dedupe = (arr: Movie[]) => {
        const seen = new Set<string>();
        return arr.filter((it) => {
          const key = getKey(it);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      try {
        const today = new Date().toISOString().split("T")[0];

        // Build params for discover endpoint - sorted by release date desc
        const params = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "primary_release_date.desc",
          "vote_count.gte": "50",
          "primary_release_date.lte": today,
        });

        // Year filter
        if (selectedYear) {
          if (selectedYear === "older") {
            params.set("primary_release_date.lte", "2019-12-31");
          } else {
            params.set("primary_release_year", selectedYear);
          }
        }

        // Genre filter
        if (selectedGenres.length > 0) {
          params.set("with_genres", selectedGenres.join(","));
        }

        const res = await fetch(`https://api.themoviedb.org/3/discover/movie?${params}`);
        const response = await res.json();

        const filteredResults = (filterAdultContent(response.results) as Movie[])
          .map((m) => ({ ...m, media_type: "movie" as const }))
          .filter(isAllowedOnMoviesPage);

        const unique = dedupe(filteredResults);

        if (reset && metaByKey.size > 0) {
          const tmdbKeys = new Set(unique.map((m) => getKey(m)));
          await hydrateDbOnly(tmdbKeys, 60);
        }

        if (reset) {
          setMovies(unique);
          setDisplayCount(BATCH_SIZE);
        } else {
          setMovies((prev) => dedupe([...prev, ...unique]));
          if (loadMoreFetchRequestedRef.current) {
            loadMoreFetchRequestedRef.current = false;
            setDisplayCount((prev) => prev + BATCH_SIZE);
          }
        }

        setHasMore(response.page < response.total_pages);
      } catch (error) {
        console.error("Failed to fetch movies:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [getKey, hydrateDbOnly, metaByKey.size, selectedGenres, selectedYear, setIsLoadingMore]
  );

  // Reset and fetch when filters change
  useEffect(() => {
    if (!isInitialized) return;
    if (isRestoredFromCache) {
      setIsRestoredFromCache(false);
      return;
    }
    setPage(1);
    setMovies([]);
    setDbOnlyHydrated([]);
    dbHydrationCursorRef.current = 0;
    setDisplayCount(0);
    setAnimateFromIndex(null);
    setHasMore(true);
    fetchMovies(1, true);
  }, [selectedGenres, selectedYear, isInitialized]);

  // Tell global loader it can stop as soon as we have real content on screen.
  useEffect(() => {
    if (!pageIsLoading && movies.length > 0) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("route:content-ready")));
    }
  }, [pageIsLoading, movies.length]);

  // Infinite scroll observer (scrolling down reveals 18 at a time; only fetch when needed)
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (isLoading || isLoadingMore || pendingLoadMore) return;

        const hasBuffered = displayCount < visibleMovies.length;
        if (!hasBuffered && !hasMore) return;

        setPendingLoadMore(true);
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [displayCount, hasMore, isLoading, isLoadingMore, pendingLoadMore, visibleMovies.length]);

  // Resolve pending "load more": reveal from buffer first, otherwise fetch next TMDB page.
  useEffect(() => {
    if (!pendingLoadMore) return;

    const hasBuffered = displayCount < visibleMovies.length;
    if (hasBuffered) {
      setAnimateFromIndex(displayCount);
      setDisplayCount((prev) => Math.min(prev + BATCH_SIZE, visibleMovies.length));
      setPendingLoadMore(false);
      return;
    }

    const hasMoreDb = dbHydrationCursorRef.current < dbCandidates.length;
    if (hasMoreDb) {
      setAnimateFromIndex(displayCount);
      setPendingLoadMore(false);
      setIsLoadingMore(true);

      void (async () => {
        try {
          const tmdbKeys = new Set(movies.map((m) => getKey(m)));
          await hydrateDbOnly(tmdbKeys, 60);
          setDisplayCount((prev) => prev + BATCH_SIZE);
        } finally {
          setIsLoadingMore(false);
        }
      })();
      return;
    }

    if (!hasMore) {
      setPendingLoadMore(false);
      return;
    }

    setAnimateFromIndex(displayCount);
    loadMoreFetchRequestedRef.current = true;
    setIsLoadingMore(true);
    setPendingLoadMore(false);
    setPage((prev) => prev + 1);
  }, [pendingLoadMore, displayCount, visibleMovies.length, hasMore, setIsLoadingMore, dbCandidates.length, getKey, hydrateDbOnly, movies]);

  // Fetch more when page changes
  useEffect(() => {
    if (page > 1 && !isRestoredFromCache) {
      fetchMovies(page);
    }
  }, [page, fetchMovies, isRestoredFromCache]);

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
  const genresForNav = genres.map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <Helmet>
        <title>Movies - DanieWatch</title>
        <meta name="description" content="Browse movies sorted by latest release date. Filter by genre and year." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="sr-only">Movies</h1>

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
            {pageIsLoading
              ? Array.from({ length: BATCH_SIZE }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="aspect-[2/3] rounded-xl animate-none" />
                    <Skeleton className="h-4 w-3/4 mt-3 animate-none" />
                    <Skeleton className="h-3 w-1/2 mt-2 animate-none" />
                  </div>
                ))
              : visibleMovies.slice(0, displayCount).map((movie, index) => {
                  const shouldAnimate =
                    animateFromIndex !== null && index >= animateFromIndex && index < animateFromIndex + BATCH_SIZE;

                  return (
                    <div key={`${movie.id}-movie`} className={shouldAnimate ? "animate-fly-in" : undefined}>
                      <MovieCard
                        movie={movie}
                        animationDelay={Math.min(index * 30, 300)}
                        enableReveal={false}
                        enableHoverPortal={false}
                      />
                    </div>
                  );
                })}
          </div>

          {/* No results message */}
          {!pageIsLoading && visibleMovies.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No movies found with the selected filters.</p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Loading More Indicator */}
          <div ref={loadMoreRef} className="flex justify-center py-6">
            {isLoadingMore && <InlineDotsLoader ariaLabel="Loading more" />}
            {!hasMore && displayCount >= visibleMovies.length && visibleMovies.length > 0 && (
              <p className="text-muted-foreground">You've reached the end</p>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Movies;
