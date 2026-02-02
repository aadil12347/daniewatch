import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { PageCurationControls } from "@/components/admin/PageCurationControls";
import { getMovieGenres, filterAdultContent, getMovieDetails, Movie, Genre } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { usePostModeration } from "@/hooks/usePostModeration";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useDbManifest } from "@/hooks/useDbManifest";
import { useSectionCuration } from "@/hooks/useSectionCuration";
import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { isAllowedOnMoviesPage } from "@/lib/contentScope";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { getPosterUrl } from "@/lib/tmdb";
import { queuePriorityCache } from "@/lib/priorityCacheBridge";

const SECTION_ID = "page_movies";

const BATCH_SIZE = 18;
const INITIAL_REVEAL_COUNT = 24;

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

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const dbHydrationCursorRef = useRef(0);

  const { saveCache, getCache } = useListStateCache<Movie>();
  const { filterBlockedPosts, sortWithPinnedFirst, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdminStatus();
  const { isEditLinksMode } = useEditLinksMode();
  const { getCuratedItems } = useSectionCuration(SECTION_ID);
  
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

      const sortYear = item.release_year ?? new Date().getFullYear();
      const hasLinks = item.hasWatch || item.hasDownload;

      out.push({ id, mediaType: "movie", sortYear, hasLinks });
    }

    // Sort: newest first (so future-dated/new posts rise to the top), then items with links.
    out.sort((a, b) => {
      if (b.sortYear !== a.sortYear) return b.sortYear - a.sortYear;
      if (a.hasLinks !== b.hasLinks) return a.hasLinks ? -1 : 1;
      return 0;
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
      const releaseYear = (meta?.release_year ?? new Date().getFullYear()) as number;

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

  const baseVisibleMovies = useMemo(() => [...filteredDbItems, ...filteredTmdbItems], [filteredDbItems, filteredTmdbItems]);
  
  // Apply curation if in edit mode
  const visibleMovies = useMemo(() => {
    if (isAdmin && isEditLinksMode) {
      return getCuratedItems(baseVisibleMovies);
    }
    return baseVisibleMovies;
  }, [baseVisibleMovies, getCuratedItems, isAdmin, isEditLinksMode]);

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

        setHasMore(response.page < response.total_pages);
      } catch (error) {
        console.error("Failed to fetch movies:", error);
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

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);

    return () => observerRef.current?.disconnect();
  }, [displayCount, hasMore, isLoading, isLoadingMore, pendingLoadMore, visibleMovies.length]);

  // Priority cache: first 10 posters are treated as "permanent" for instant return visits.
  useEffect(() => {
    if (pageIsLoading) return;
    const first = visibleMovies.slice(0, 10);
    const posterUrls = first
      .map((m) => getPosterUrl((m as any)?.poster_path ?? null, "w342"))
      .filter(Boolean) as string[];
    queuePriorityCache("/movies", posterUrls);
  }, [pageIsLoading, visibleMovies]);

  // Resolve pending "load more": reveal from buffer first. Only fetch next TMDB page AFTER all DB items are revealed.
  useEffect(() => {
    if (!pendingLoadMore) return;

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

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-6 pb-8">
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

          {/* Admin Curation Controls */}
          <PageCurationControls sectionId={SECTION_ID} sectionTitle="Movies" className="mb-6" />

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
                    <div key={getKey(movie)} className={shouldAnimate ? "animate-fly-in" : undefined}>
                      <MovieCard
                        movie={movie}
                        animationDelay={Math.min(index * 30, 300)}
                        enableReveal={false}
                        enableHoverPortal={false}
                        sectionId={SECTION_ID}
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
          <div className="relative">
            {/* Sentinel (observer watches this) */}
            <div ref={loadMoreRef} className="h-px w-full" />

            {!isLoadingMore && !hasMore && displayCount >= visibleMovies.length && visibleMovies.length > 0 && (
              <div className="flex justify-center py-6">
                <p className="text-muted-foreground">You've reached the end</p>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Movies;
