import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { CategoryNav } from "@/components/CategoryNav";
import { getMovieGenres, filterAdultContent, getMovieDetails, Movie, Genre } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { usePostModeration } from "@/hooks/usePostModeration";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useDbManifest } from "@/hooks/useDbManifest";
import { isAllowedOnMoviesPage } from "@/lib/contentScope";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { VirtualizedPosterGrid } from "@/components/VirtualizedPosterGrid";

const BATCH_SIZE = 18;
const INITIAL_REVEAL_COUNT = 24;
const TMDB_MAX_PAGE = 500;

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
  const restoreScrollYRef = useRef<number | null>(null);

  const dbHydrationCursorRef = useRef(0);

  const { saveCache, getCache } = useListStateCache<Movie>();
  const { filterBlockedPosts, sortWithPinnedFirst, isLoading: isModerationLoading } = usePostModeration();
  
  // Use manifest for DB metadata (fast, cached)
  const {
    items: manifestItems,
    metaByKey: manifestMetaByKey,
    isLoading: isManifestLoading,
  } = useDbManifest();

  const getKey = useCallback((m: Pick<Movie, "id" | "media_type" | "first_air_date">) => {
    const media = (m.media_type as "movie" | "tv" | undefined) ?? (m.first_air_date ? "tv" : "movie");
    return `${m.id}-${media}`;
  }, []);

  // Build DB entries from manifest
  const dbEntriesMatchingFilters = useMemo(() => {
    return manifestItems.filter((item) => {
      if (item.media_type !== "movie") return false;

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

  const dbCandidates = useMemo(() => {
    const out: Array<{ id: number; mediaType: "movie"; sortYear: number; hasLinks: boolean }> = [];

    for (const item of dbEntriesMatchingFilters) {
      const id = item.id;
      if (!Number.isFinite(id)) continue;

      // Enforce Movies-page scope using DB metadata
      const lang = item.original_language ?? null;
      const genreIds = item.genre_ids ?? [];
      const origin = item.origin_country ?? [];

      const isAnime = lang === "ja" && genreIds.includes(16);
      const isIndian = ["hi", "ta", "te"].includes(lang ?? "");
      const isKorean = ["ko", "zh", "tr"].includes(lang ?? "") || origin.some((c) => ["KR", "CN", "TW", "HK", "TR"].includes(c));

      if (isAnime || isIndian || isKorean) continue;

      const sortYear = item.release_year ?? 0;
      const hasLinks = item.hasWatch || item.hasDownload;

      out.push({ id, mediaType: "movie", sortYear, hasLinks });
    }

    // Sort: items with links first, then by year descending
    out.sort((a, b) => {
      if (a.hasLinks !== b.hasLinks) return a.hasLinks ? -1 : 1;
      return b.sortYear - a.sortYear;
    });

    return out;
  }, [dbEntriesMatchingFilters]);

  const hydrateDbOnly = useCallback(
    async (tmdbKeys: Set<string>, limit: number) => {
      if (manifestMetaByKey.size === 0) return;

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
    [dbCandidates, dbOnlyHydrated, getKey, manifestMetaByKey.size]
  );

  const manifestItemByKey = useMemo(() => {
    const map = new Map<string, any>();
    for (const it of manifestItems) {
      if (it.media_type !== "movie") continue;
      map.set(`${it.id}-movie`, it);
    }
    return map;
  }, [manifestItems]);

  // Full DB list as lightweight stubs (visibility/order comes from DB, not hydration).
  const dbStubItems = useMemo((): Movie[] => {
    return dbCandidates.map(({ id }) => {
      const meta = manifestItemByKey.get(`${id}-movie`);
      const title = meta?.title ?? meta?.name ?? meta?.original_title ?? "Untitled";
      const genre_ids = (meta?.genre_ids ?? []) as number[];
      const releaseYear = (meta?.release_year ?? 0) as number;

      return {
        id,
        media_type: "movie" as const,
        title,
        original_title: title,
        genre_ids,
        release_date: releaseYear ? `${releaseYear}-01-01` : "",

        // Manifest already stores full image URLs.
        poster_path: meta?.poster_url ?? null,

        // Extra fields MovieCard can use immediately.
        vote_average: meta?.vote_average ?? undefined,
        vote_count: meta?.vote_count ?? undefined,
        logo_url: meta?.logo_url ?? null,
        backdrop_path: meta?.backdrop_url ?? undefined,
      } as unknown as Movie;
    });
  }, [dbCandidates, manifestItemByKey]);

  // Prefer hydrated items if available, but always replace in-place (no reordering).
  const hydratedByKey = useMemo(() => {
    const map = new Map<string, Movie>();
    for (const m of movies) map.set(getKey(m), m);
    for (const m of dbOnlyHydrated) map.set(getKey(m), m);
    return map;
  }, [dbOnlyHydrated, getKey, movies]);

  const dbVisibleItems = useMemo(() => {
    return dbStubItems.map((stub) => hydratedByKey.get(getKey(stub)) ?? stub);
  }, [dbStubItems, getKey, hydratedByKey]);

  const tmdbOnlyItems = useMemo(() => {
    const dbKeys = new Set(dbStubItems.map((m) => getKey(m)));
    return movies.filter((m) => !dbKeys.has(getKey(m)));
  }, [dbStubItems, getKey, movies]);

  const baseDbVisible = useMemo(() => filterBlockedPosts(dbVisibleItems, "movie"), [dbVisibleItems, filterBlockedPosts]);
  const baseTmdbVisible = useMemo(() => filterBlockedPosts(tmdbOnlyItems, "movie"), [filterBlockedPosts, tmdbOnlyItems]);

  const dbSorted = useMemo(() => sortWithPinnedFirst(baseDbVisible, "movies", "movie"), [baseDbVisible, sortWithPinnedFirst]);
  const tmdbSorted = useMemo(() => sortWithPinnedFirst(baseTmdbVisible, "movies", "movie"), [baseTmdbVisible, sortWithPinnedFirst]);

  const filteredDbItems = dbSorted;
  const filteredTmdbItems = tmdbSorted;

  const visibleMovies = useMemo(() => [...filteredDbItems, ...filteredTmdbItems], [filteredDbItems, filteredTmdbItems]);

  // Preload hover images in the background ONLY (never gate the grid render on this).
  usePageHoverPreload(visibleMovies, { enabled: !isLoading });

  // If we have DB items from the manifest, show them immediately (even before TMDB fetch/hydration finishes).
  useEffect(() => {
    if (isRestoredFromCache) return;
    if (displayCount > 0) return;
    if (isManifestLoading) return;

    if (filteredDbItems.length > 0) {
      setDisplayCount(Math.min(INITIAL_REVEAL_COUNT, filteredDbItems.length));
    }
  }, [displayCount, filteredDbItems.length, isManifestLoading, isRestoredFromCache]);

  // Only show skeletons before we have any real items to render.
  const pageIsLoading = displayCount === 0 && (isLoading || isModerationLoading || isManifestLoading);

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
    const cachedPage = cached?.page ?? 1;
    const cacheLooksValid =
      !!cached &&
      Array.isArray(cached.items) &&
      cached.items.length > 0 &&
      Number.isFinite(cachedPage) &&
      cachedPage >= 1 &&
      cachedPage <= TMDB_MAX_PAGE;

    if (cacheLooksValid) {
      restoreScrollYRef.current = cached.scrollY ?? 0;
      setMovies(cached.items);
      setDisplayCount(cached.items.length);
      setAnimateFromIndex(null);
      setPage(cachedPage);
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
      // TMDB hard limit: pages are 1..500
      if (pageNum < 1 || pageNum > TMDB_MAX_PAGE) {
        setHasMore(false);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

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

        // TMDB can return { success:false, ... } (sometimes with 200/400). Guard against it.
        if (!response || response.success === false || !Array.isArray(response.results)) {
          setHasMore(false);
          return;
        }

        const filteredResults = (filterAdultContent(response.results) as Movie[])
          .map((m) => ({ ...m, media_type: "movie" as const }))
          .filter(isAllowedOnMoviesPage);

        const unique = dedupe(filteredResults);

        if (reset && manifestMetaByKey.size > 0) {
          const tmdbKeys = new Set(unique.map((m) => getKey(m)));
          await hydrateDbOnly(tmdbKeys, 60);
        }

        if (reset) {
          setMovies(unique);
          setDisplayCount(INITIAL_REVEAL_COUNT);
        } else {
          setMovies((prev) => dedupe([...prev, ...unique]));
          if (loadMoreFetchRequestedRef.current) {
            loadMoreFetchRequestedRef.current = false;
            setDisplayCount((prev) => prev + BATCH_SIZE);
          }
        }

        setHasMore(Number(response.page) < Number(response.total_pages));
      } catch (error) {
        console.error("Failed to fetch movies:", error);
        setHasMore(false);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [getKey, hydrateDbOnly, manifestMetaByKey.size, selectedGenres, selectedYear, setIsLoadingMore]
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

  // Keep the global fullscreen loader until the first 24 tiles are actually visible.
  const routeReady =
    !pageIsLoading && (visibleMovies.length === 0 || displayCount >= Math.min(INITIAL_REVEAL_COUNT, visibleMovies.length));
  useRouteContentReady(routeReady);

  // Infinite scroll observer (scrolling down reveals 18 at a time; only fetch when needed)
  // NOTE: load-more is driven by VirtualizedPosterGrid.onEndReached.

  // Resolve pending "load more": reveal from buffer first. Only fetch next TMDB page AFTER all DB items are revealed.
  useEffect(() => {
    if (!pendingLoadMore) return;

    // Never paginate/reveal when we have nothing at all yet (prevents runaway loops).
    if (visibleMovies.length === 0) {
      setPendingLoadMore(false);
      return;
    }

    const hasBuffered = displayCount < visibleMovies.length;
    if (hasBuffered) {
      setAnimateFromIndex(displayCount);
      setDisplayCount((prev) => Math.min(prev + BATCH_SIZE, visibleMovies.length));
      setPendingLoadMore(false);

      // Background hydration for upcoming DB stubs (never affects ordering).
      if (displayCount < filteredDbItems.length) {
        const tmdbKeys = new Set(movies.map((m) => getKey(m)));
        void hydrateDbOnly(tmdbKeys, 30);
      }

      return;
    }

    // Don't fetch TMDB until user has scrolled past the DB partition.
    if (displayCount < filteredDbItems.length) {
      setPendingLoadMore(false);
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
  }, [pendingLoadMore, displayCount, visibleMovies.length, filteredDbItems.length, hasMore, movies, getKey, hydrateDbOnly, setIsLoadingMore]);

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

      <main className="min-h-[100dvh] bg-background overflow-x-hidden flex flex-col">
        <div className="w-full flex-1 flex flex-col px-3 sm:px-4 md:px-6 lg:px-8 pt-6 pb-4">
          <h1 className="sr-only">Movies</h1>

          {/* Category Navigation */}
          <div className="mb-6">
            <CategoryNav
              genres={genresForNav}
              selectedGenres={selectedGenres}
              onGenreToggle={toggleGenre}
              onClearGenres={clearGenres}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
            />
          </div>

          {/* Full-height container-scroll grid (fills remaining viewport, no black gaps) */}
          <div className="relative flex-1 min-h-0">
            {/** Ensure we never render an empty non-loading grid (avoids blank first paint). */}
            <VirtualizedPosterGrid
              className="h-full"
              items={pageIsLoading ? [] : visibleMovies.slice(0, displayCount)}
              isLoading={pageIsLoading || displayCount === 0}
              skeletonCount={BATCH_SIZE}
              onEndReached={() => {
                if (pageIsLoading) return;
                if (isLoading || isLoadingMore || pendingLoadMore) return;
                const hasBuffered = displayCount < visibleMovies.length;
                if (!hasBuffered && !hasMore) return;
                setPendingLoadMore(true);
              }}
            />

            {/* Loading More Indicator (overlay, avoids creating extra bottom space) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
              {isLoadingMore && <InlineDotsLoader ariaLabel="Loading more" />}
              {!isLoadingMore && !hasMore && displayCount >= visibleMovies.length && visibleMovies.length > 0 && (
                <p className="text-muted-foreground">You've reached the end</p>
              )}
            </div>
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
        </div>
      </main>
    </>
  );
};

export default Movies;
