import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Movie, filterAdultContent, getTVDetails } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useDbManifest } from "@/hooks/useDbManifest";
import { isAnimeScope } from "@/lib/contentScope";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";

const ANIME_GENRE_ID = 16; // Animation genre ID

// Anime-specific sub-genres/tags
const ANIME_TAGS = [
  { id: "action", label: "Action", genreId: 10759 },
  { id: "comedy", label: "Comedy", genreId: 35 },
  { id: "drama", label: "Drama", genreId: 18 },
  { id: "fantasy", label: "Fantasy", genreId: 10765 },
  { id: "romance", label: "Romance", genreId: 10749 },
  { id: "mystery", label: "Mystery", genreId: 9648 },
  { id: "scifi", label: "Sci-Fi", genreId: 10765 },
  { id: "kids", label: "Kids", genreId: 10762 },
];

const BATCH_SIZE = 18;
const INITIAL_REVEAL_COUNT = 24;

const Anime = () => {
  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  
  // Use manifest for DB metadata (fast, cached)
  const {
    items: manifestItems,
    metaByKey: manifestMetaByKey,
    isLoading: isManifestLoading,
  } = useDbManifest();

  const [items, setItems] = useState<Movie[]>([]);
  const [dbOnlyHydrated, setDbOnlyHydrated] = useState<Movie[]>([]);

  const [displayCount, setDisplayCount] = useState(0);
  const [animateFromIndex, setAnimateFromIndex] = useState<number | null>(null);
  const [pendingLoadMore, setPendingLoadMore] = useState(false);
  const loadMoreFetchRequestedRef = useRef(false);

  const [selectedTags, setSelectedTags] = useState<number[]>([]);
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

  const getKey = useCallback((m: Pick<Movie, "id" | "media_type" | "first_air_date">) => {
    const media = (m.media_type as "movie" | "tv" | undefined) ?? (m.first_air_date ? "tv" : "movie");
    return `${m.id}-${media}`;
  }, []);

  const normalizedDbGenreSet = useMemo(() => new Set<number>([ANIME_GENRE_ID, ...selectedTags]), [selectedTags]);

  // Build DB entries from manifest
  const dbEntriesMatchingFilters = useMemo(() => {
    return manifestItems.filter((item) => {
      if (item.media_type !== "tv") return false;

      const genreIds = item.genre_ids ?? [];
      const year = item.release_year ?? null;

      // Must be anime in DB metadata
      if (!genreIds.includes(ANIME_GENRE_ID)) return false;

      // Tag filter (overlap)
      if (normalizedDbGenreSet.size > 0) {
        const hasOverlap = genreIds.some((g) => normalizedDbGenreSet.has(g));
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
  }, [manifestItems, normalizedDbGenreSet, selectedYear]);

  const dbCandidates = useMemo(() => {
    const out: Array<{ id: number; sortYear: number; hasLinks: boolean }> = [];

    for (const item of dbEntriesMatchingFilters) {
      const id = item.id;
      if (!Number.isFinite(id)) continue;

      // Anime page scope requires Japanese language
      if (item.original_language !== "ja") continue;

      const sortYear = item.release_year ?? 0;
      const hasLinks = item.hasWatch || item.hasDownload;

      out.push({ id, sortYear, hasLinks });
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

        const key = `${c.id}-tv`;
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
              const d = await getTVDetails(id);
              return { ...d, media_type: "tv" as const } as Movie;
            } catch {
              return null;
            }
          })
        );

        const cleaned = hydrated.filter(Boolean) as Movie[];
        const filtered = (filterAdultContent(cleaned) as Movie[]).filter(isAnimeScope);
        results.push(...filtered);
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
      if (it.media_type !== "tv") continue;
      map.set(`${it.id}-tv`, it);
    }
    return map;
  }, [manifestItems]);

  const dbStubItems = useMemo((): Movie[] => {
    return dbCandidates.map(({ id }) => {
      const meta = manifestItemByKey.get(`${id}-tv`);
      const title = meta?.title ?? meta?.name ?? meta?.original_name ?? "Untitled";
      const genre_ids = (meta?.genre_ids ?? [ANIME_GENRE_ID]) as number[];
      const releaseYear = (meta?.release_year ?? 0) as number;

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

  const hydratedByKey = useMemo(() => {
    const map = new Map<string, Movie>();
    for (const m of items) map.set(getKey(m), m);
    for (const m of dbOnlyHydrated) map.set(getKey(m), m);
    return map;
  }, [dbOnlyHydrated, getKey, items]);

  const dbVisibleItems = useMemo(() => {
    return dbStubItems.map((stub) => hydratedByKey.get(getKey(stub)) ?? stub);
  }, [dbStubItems, getKey, hydratedByKey]);

  const tmdbOnlyItems = useMemo(() => {
    const dbKeys = new Set(dbStubItems.map((m) => getKey(m)));
    return items.filter((m) => !dbKeys.has(getKey(m)));
  }, [dbStubItems, getKey, items]);

  const baseDbVisible = useMemo(() => filterBlockedPosts(dbVisibleItems, "tv"), [dbVisibleItems, filterBlockedPosts]);
  const baseTmdbVisible = useMemo(() => filterBlockedPosts(tmdbOnlyItems, "tv"), [filterBlockedPosts, tmdbOnlyItems]);

  const filteredDbItems = baseDbVisible;
  const filteredTmdbItems = baseTmdbVisible;

  const visibleItems = useMemo(() => [...filteredDbItems, ...filteredTmdbItems], [filteredDbItems, filteredTmdbItems]);

  // Preload hover images in the background ONLY (never gate the grid render on this).
  usePageHoverPreload(visibleItems, { enabled: !isLoading });

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
  const pageIsLoading = visibleItems.length === 0 && (isLoading || isModerationLoading || isManifestLoading);

  const { saveCache, getCache } = useListStateCache<Movie>();

  // Try to restore from cache on mount
  useEffect(() => {
    const cached = getCache("default", selectedTags);
    if (cached && cached.items.length > 0) {
      restoreScrollYRef.current = cached.scrollY ?? 0;
      setItems(cached.items);
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
    if (items.length === 0) return;

    const y = restoreScrollYRef.current;
    if (y === null) return;
    restoreScrollYRef.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      });
    });
  }, [isRestoredFromCache, items.length]);

  // Save cache before unmount
  useEffect(() => {
    return () => {
      if (items.length > 0) {
        saveCache({
          items,
          page,
          hasMore,
          activeTab: "default",
          selectedFilters: selectedTags,
        });
      }
    };
  }, [items, page, hasMore, selectedTags, saveCache]);

  const fetchAnime = useCallback(
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
        const allGenres = [ANIME_GENRE_ID, ...selectedTags];

        // Build params - sorted by first air date desc
        const params = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "first_air_date.desc",
          with_genres: allGenres.join(","),
          with_original_language: "ja",
          "vote_count.gte": "20",
          "first_air_date.lte": today,
        });

        // Year filter
        if (selectedYear) {
          if (selectedYear === "older") {
            params.set("first_air_date.lte", "2019-12-31");
          } else {
            params.set("first_air_date_year", selectedYear);
          }
        }

        const res = await fetch(`https://api.themoviedb.org/3/discover/tv?${params}`);
        const response = await res.json();

        const filteredResults = (filterAdultContent(response.results) as Movie[])
          .map((m) => ({ ...m, media_type: "tv" as const }))
          .filter(isAnimeScope);

        const unique = dedupe(filteredResults);

        if (reset && manifestMetaByKey.size > 0) {
          const tmdbKeys = new Set(unique.map((m) => getKey(m)));
          await hydrateDbOnly(tmdbKeys, 60);
        }

        const visibleResults = filterBlockedPosts(unique, "tv");

        if (reset) {
          setItems(visibleResults);
          setDisplayCount(INITIAL_REVEAL_COUNT);
        } else {
          setItems((prev) => dedupe([...prev, ...visibleResults]));
          if (loadMoreFetchRequestedRef.current) {
            loadMoreFetchRequestedRef.current = false;
            setDisplayCount((prev) => prev + BATCH_SIZE);
          }
        }
        setHasMore(response.page < response.total_pages);
      } catch (error) {
        console.error("Failed to fetch anime:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filterBlockedPosts, getKey, hydrateDbOnly, manifestMetaByKey.size, selectedTags, selectedYear, setIsLoadingMore]
  );

  // Reset and fetch when filters change
  useEffect(() => {
    if (!isInitialized) return;
    if (isRestoredFromCache) {
      setIsRestoredFromCache(false);
      return;
    }
    setPage(1);
    setItems([]);
    setDbOnlyHydrated([]);
    dbHydrationCursorRef.current = 0;
    setDisplayCount(0);
    setAnimateFromIndex(null);
    setHasMore(true);
    fetchAnime(1, true);
  }, [selectedTags, selectedYear, isInitialized]);

  // Keep the global fullscreen loader until the first 24 tiles are actually visible.
  const routeReady =
    !pageIsLoading && (visibleItems.length === 0 || displayCount >= Math.min(INITIAL_REVEAL_COUNT, visibleItems.length));
  useRouteContentReady(routeReady);


  // Infinite scroll observer (scrolling down reveals 18 at a time; only fetch when needed)
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (isLoading || isLoadingMore || pendingLoadMore) return;

        const hasBuffered = displayCount < visibleItems.length;
        if (!hasBuffered && !hasMore) return;

        setPendingLoadMore(true);
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [displayCount, hasMore, isLoading, isLoadingMore, pendingLoadMore, visibleItems.length]);

  // Resolve pending "load more": reveal from buffer first. Only fetch next TMDB page AFTER all DB items are revealed.
  useEffect(() => {
    if (!pendingLoadMore) return;

    const hasBuffered = displayCount < visibleItems.length;
    if (hasBuffered) {
      setAnimateFromIndex(displayCount);
      setDisplayCount((prev) => Math.min(prev + BATCH_SIZE, visibleItems.length));
      setPendingLoadMore(false);

      if (displayCount < filteredDbItems.length) {
        const tmdbKeys = new Set(items.map((m) => getKey(m)));
        void hydrateDbOnly(tmdbKeys, 30);
      }

      return;
    }

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
  }, [pendingLoadMore, displayCount, visibleItems.length, filteredDbItems.length, hasMore, items, getKey, hydrateDbOnly, setIsLoadingMore]);

  // Fetch more when page changes
  useEffect(() => {
    if (page > 1 && !isRestoredFromCache) {
      fetchAnime(page);
    }
  }, [page, fetchAnime, isRestoredFromCache]);

  const toggleTag = (genreId: number) => {
    setSelectedTags((prev) => (prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]));
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedYear(null);
  };

  // Convert tags to genre format for CategoryNav
  const genresForNav = ANIME_TAGS.map((tag) => ({ id: tag.genreId, name: tag.label }));

  return (
    <>
      <Helmet>
        <title>Anime - DanieWatch</title>
        <meta name="description" content="Watch the best anime series sorted by latest release. Filter by genre and year." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-6 pb-8">
          <h1 className="sr-only">Anime</h1>

          {/* Category Navigation */}
          <div className="mb-8">
            <CategoryNav
              genres={genresForNav}
              selectedGenres={selectedTags}
              onGenreToggle={toggleTag}
              onClearGenres={clearTags}
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
              : visibleItems.slice(0, displayCount).map((item, index) => {
                  const shouldAnimate =
                    animateFromIndex !== null && index >= animateFromIndex && index < animateFromIndex + BATCH_SIZE;

                  return (
                    <div key={`${item.id}-${item.media_type ?? "tv"}`} className={shouldAnimate ? "animate-fly-in" : undefined}>
                      <MovieCard
                        movie={item}
                        animationDelay={Math.min(index * 30, 300)}
                        enableReveal={false}
                        enableHoverPortal={false}
                      />
                    </div>
                  );
                })}
          </div>

          {/* No results message */}
          {!pageIsLoading && visibleItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No anime found with the selected filters.</p>
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
            {!hasMore && visibleItems.length > 0 && <p className="text-muted-foreground">You've reached the end</p>}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Anime;
