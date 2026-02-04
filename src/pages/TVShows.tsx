import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";

import { getTVGenres, filterAdultContent, Movie, Genre } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useDbManifest } from "@/hooks/useDbManifest";
import { KOREAN_LANGS, INDIAN_LANGS, isAllowedOnTvPage } from "@/lib/contentScope";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { getPosterUrl } from "@/lib/tmdb";
import { queuePriorityCache } from "@/lib/priorityCacheBridge";

const SECTION_ID = "page_tv";

const BATCH_SIZE = 18;
const INITIAL_REVEAL_COUNT = 24;

const TVShows = () => {
  const [tmdbItems, setTmdbItems] = useState<Movie[]>([]);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const [displayCount, setDisplayCount] = useState(0);
  const [animateFromIndex, setAnimateFromIndex] = useState<number | null>(null);
  const [pendingLoadMore, setPendingLoadMore] = useState(false);

  const [isLoadingMore, setIsLoadingMore] = useMinDurationLoading(600);
  const [tmdbPage, setTmdbPage] = useState(1);
  const [hasMoreTmdb, setHasMoreTmdb] = useState(true);

  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const restoreScrollYRef = useRef<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { saveCache, getCache } = useListStateCache<Movie>();
  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();

  // Use manifest for DB metadata (fast, cached)
  const { items: manifestItems, isLoading: isManifestLoading } = useDbManifest();

  const getKey = useCallback((m: Pick<Movie, "id" | "media_type" | "first_air_date">) => {
    const media = (m.media_type as "movie" | "tv" | undefined) ?? (m.first_air_date ? "tv" : "movie");
    return `${m.id}-${media}`;
  }, []);

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

      // Exclude category pages content (Anime / Korean / Indian) using DB metadata
      const lang = item.original_language ?? null;
      const origin = item.origin_country ?? [];

      const isAnime = lang === "ja" && genreIds.includes(16);
      const isKorean =
        (!!lang && (KOREAN_LANGS as readonly string[]).includes(lang)) ||
        origin.some((c) => ["KR", "CN", "TW", "HK", "TR"].includes(c));

      if (isAnime || isKorean) return false;

      return true;
    });
  }, [manifestItems, selectedGenres, selectedYear]);

  const dbCandidates = useMemo(() => {
    const out: Array<{ id: number; sortYear: number; hasLinks: boolean }> = [];

    for (const item of dbEntriesMatchingFilters) {
      const id = item.id;
      if (!Number.isFinite(id)) continue;

      const sortYear = item.release_year ?? new Date().getFullYear();
      const hasLinks = item.hasWatch || item.hasDownload;

      out.push({ id, sortYear, hasLinks });
    }

    // Sort: newest first (so future-dated/new posts rise to the top), then items with links.
    out.sort((a, b) => {
      if (b.sortYear !== a.sortYear) return b.sortYear - a.sortYear;
      if (a.hasLinks !== b.hasLinks) return a.hasLinks ? -1 : 1;
      return 0;
    });

    return out;
  }, [dbEntriesMatchingFilters]);

  const manifestItemByKey = useMemo(() => {
    const map = new Map<string, any>();
    for (const it of manifestItems) {
      if (it.media_type !== "tv") continue;
      map.set(`${it.id}-tv`, it);
    }
    return map;
  }, [manifestItems]);

  // DB-first: build complete-looking stubs from the manifest
  const dbStubItems = useMemo((): Movie[] => {
    return dbCandidates.map(({ id }) => {
      const meta = manifestItemByKey.get(`${id}-tv`);
      const title = meta?.title ?? meta?.name ?? meta?.original_name ?? "Untitled";
      const genre_ids = (meta?.genre_ids ?? []) as number[];
      const releaseYear = (meta?.release_year ?? new Date().getFullYear()) as number;

      return {
        id,
        media_type: "tv" as const,
        name: title,
        original_name: title,
        genre_ids,
        first_air_date: releaseYear ? `${releaseYear}-01-01` : "",

        poster_path: meta?.poster_url ?? null,
        vote_average: meta?.vote_average ?? undefined,
        vote_count: meta?.vote_count ?? undefined,
        logo_url: meta?.logo_url ?? null,
        backdrop_path: meta?.backdrop_url ?? undefined,
      } as unknown as Movie;
    });
  }, [dbCandidates, manifestItemByKey]);

  const baseDbVisible = useMemo(() => filterBlockedPosts(dbStubItems, "tv"), [dbStubItems, filterBlockedPosts]);
  const baseTmdbVisible = useMemo(() => filterBlockedPosts(tmdbItems, "tv"), [filterBlockedPosts, tmdbItems]);

  const filteredDbItems = baseDbVisible;
  const filteredTmdbItems = baseTmdbVisible;

  // --- Partitioned Sorting ---
  const unifiedItems = useMemo(() => {
    const getDateValue = (m: Movie) => {
      const dateStr = (m as any).first_air_date || m.release_date;
      if (!dateStr) return -8640000000000000;
      return new Date(dateStr).getTime();
    };

    const sortedDb = [...filteredDbItems].sort((a, b) => {
      const dA = getDateValue(a);
      const dB = getDateValue(b);
      if (dB !== dA) return dB - dA;
      return b.id - a.id;
    });

    const dbKeys = new Set(sortedDb.map((m) => getKey(m)));
    const tmdbDeduped = filteredTmdbItems.filter((m) => !dbKeys.has(getKey(m)));

    const sortedTmdb = [...tmdbDeduped].sort((a, b) => {
      const dA = getDateValue(a);
      const dB = getDateValue(b);
      if (dB !== dA) return dB - dA;
      return b.id - a.id;
    });

    return [...sortedDb, ...sortedTmdb];
  }, [filteredDbItems, filteredTmdbItems, getKey]);

  usePageHoverPreload(unifiedItems, { enabled: displayCount > 0 });

  const pageIsLoading = displayCount === 0 && (isManifestLoading || isModerationLoading);

  // Show DB items immediately when manifest is ready.
  useEffect(() => {
    if (displayCount > 0) return;
    if (isManifestLoading) return;
    if (filteredDbItems.length > 0) {
      setDisplayCount(Math.min(INITIAL_REVEAL_COUNT, filteredDbItems.length));
    }
  }, [displayCount, filteredDbItems.length, isManifestLoading]);

  const fetchTmdbPage = useCallback(
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

      try {
        const res = await fetch(`https://api.themoviedb.org/3/discover/tv?${params}`);
        if (!res.ok) throw new Error("TMDB fetch failed");
        const response = await res.json();

        const scoped = (filterAdultContent(response.results || []) as Movie[])
          .map((m) => ({ ...m, media_type: "tv" as const }))
          .filter(isAllowedOnTvPage);

        return {
          page: response.page || pageNum,
          totalPages: response.total_pages || 1,
          results: scoped,
        };
      } catch (error) {
        console.error("fetchTmdbPage failed:", error);
        return { page: pageNum, totalPages: 1, results: [] };
      }
    },
    [selectedGenres, selectedYear]
  );

  // Infinite scroll observer (Korean-style)
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (isLoadingMore || pendingLoadMore) return;

        const hasBuffered = displayCount < unifiedItems.length;
        if (!hasBuffered && !hasMoreTmdb) return;

        setPendingLoadMore(true);
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);

    return () => observerRef.current?.disconnect();
  }, [displayCount, hasMoreTmdb, isLoadingMore, pendingLoadMore, unifiedItems.length]);

  useEffect(() => {
    if (pageIsLoading) return;
    const first = unifiedItems.slice(0, 10);
    const posterUrls = first
      .map((m) => getPosterUrl((m as any)?.poster_path ?? null, "w342"))
      .filter(Boolean) as string[];
    queuePriorityCache("/tv", posterUrls);
  }, [pageIsLoading, unifiedItems]);

  // Resolve pending load more: reveal DB first; only then start fetching TMDB pages.
  useEffect(() => {
    if (!pendingLoadMore) return;

    const hasBuffered = displayCount < unifiedItems.length;
    if (hasBuffered) {
      setAnimateFromIndex(displayCount);
      setDisplayCount((prev) => Math.min(prev + BATCH_SIZE, unifiedItems.length));
      setPendingLoadMore(false);
      return;
    }

    if (!hasMoreTmdb) {
      setPendingLoadMore(false);
      return;
    }

    setAnimateFromIndex(displayCount);
    setIsLoadingMore(true);
    setPendingLoadMore(false);

    void (async () => {
      try {
        const { results, totalPages } = await fetchTmdbPage(tmdbPage);

        if (results.length > 0) {
          setTmdbItems((prev) => {
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

        setHasMoreTmdb(tmdbPage < totalPages);
        setTmdbPage((p) => p + 1);

        // Reveal immediately after fetching
        setDisplayCount((prev) => prev + BATCH_SIZE);
      } catch (e) {
        console.error("Failed to fetch TV shows:", e);
        setHasMoreTmdb(false);
      } finally {
        setIsLoadingMore(false);
      }
    })();
  }, [displayCount, fetchTmdbPage, filteredDbItems.length, getKey, hasMoreTmdb, pendingLoadMore, tmdbPage, unifiedItems.length, setIsLoadingMore]);

  // Try to restore from cache on mount
  // Try to restore from cache on mount
  useEffect(() => {
    try {
      const cached = getCache("default", selectedGenres);
      if (cached && cached.items.length > 0) {
        restoreScrollYRef.current = cached.scrollY ?? 0;
        setTmdbItems(cached.items);
        setDisplayCount(cached.items.length);
        setAnimateFromIndex(null);
        setTmdbPage(cached.page);
        setHasMoreTmdb(cached.hasMore);
        setIsRestoredFromCache(true);
      }
    } catch (e) {
      console.error("Error restoring cache", e);
      sessionStorage.removeItem("listCache_/tv"); // Hardcoded key clear for safety
    }
  }, []);

  // Restore scroll position after cache is applied
  useEffect(() => {
    if (!isRestoredFromCache) return;
    if (unifiedItems.length === 0) return;

    const y = restoreScrollYRef.current;
    if (y === null) return;
    restoreScrollYRef.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      });
    });
  }, [isRestoredFromCache, unifiedItems.length]);

  // Auto-save cache on state changes (debounced)
  useEffect(() => {
    if (unifiedItems.length === 0 || pageIsLoading) return;

    const handle = window.setTimeout(() => {
      saveCache({
        items: tmdbItems,
        page: tmdbPage,
        hasMore: hasMoreTmdb,
        activeTab: "default",
        selectedFilters: selectedGenres,
        scrollY: window.scrollY,
      });
    }, 500);

    return () => window.clearTimeout(handle);
  }, [tmdbItems, tmdbPage, hasMoreTmdb, selectedGenres, saveCache, pageIsLoading, unifiedItems.length]);

  // Also save on scroll (debounced)
  useEffect(() => {
    if (pageIsLoading || unifiedItems.length === 0) return;

    const handleScroll = () => {
      const handle = window.setTimeout(() => {
        saveCache({
          items: tmdbItems,
          page: tmdbPage,
          hasMore: hasMoreTmdb,
          activeTab: "default",
          selectedFilters: selectedGenres,
          scrollY: window.scrollY,
        });
      }, 1000);
      return () => window.clearTimeout(handle);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [tmdbItems, tmdbPage, hasMoreTmdb, selectedGenres, saveCache, pageIsLoading, unifiedItems.length]);

  // Reset TMDB state when filters change OR manifest becomes ready
  useEffect(() => {
    if (isManifestLoading) return;

    if (isRestoredFromCache) {
      setIsRestoredFromCache(false);
      return;
    }

    setTmdbItems([]);
    setTmdbPage(1);
    setHasMoreTmdb(true);
    setAnimateFromIndex(null);

    // Reveal DB section first
    setDisplayCount(Math.min(INITIAL_REVEAL_COUNT, filteredDbItems.length));

    // ONLY fetch from TMDB if manifest is ready, to prevent layout jumping
    fetchTmdbPage(1).then(res => {
      if (res.results.length > 0) {
        setTmdbItems(res.results);
        setHasMoreTmdb(res.page < res.totalPages);
        setTmdbPage(2);
      }
    });
  }, [selectedGenres, selectedYear, isManifestLoading, filteredDbItems.length]);

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

  // Keep the global fullscreen loader until the first 24 tiles are actually visible.
  const routeReady =
    !pageIsLoading && (unifiedItems.length === 0 || displayCount >= Math.min(INITIAL_REVEAL_COUNT, unifiedItems.length));
  useRouteContentReady(routeReady);


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
        <div className="container mx-auto px-4 pt-6 pb-8">
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
              : unifiedItems.slice(0, displayCount).map((show, index) => {
                const shouldAnimate =
                  animateFromIndex !== null && index >= animateFromIndex && index < animateFromIndex + BATCH_SIZE;

                return (
                  <div key={getKey(show)} className={shouldAnimate ? "animate-fly-in" : undefined}>
                    <MovieCard
                      movie={show as any}
                      animationDelay={Math.min(index * 30, 300)}
                      enableReveal={false}
                      enableHoverPortal={false}
                    />
                  </div>
                );
              })}
          </div>

          {/* No results message */}
          {!pageIsLoading && unifiedItems.length === 0 && (
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
          <div className="relative">
            {/* Sentinel (observer watches this) */}
            <div ref={loadMoreRef} className="h-px w-full" />

            {!isLoadingMore && !hasMoreTmdb && displayCount >= unifiedItems.length && unifiedItems.length > 0 && (
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

export default TVShows;
