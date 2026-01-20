import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Movie, filterAdultContentStrict, getMovieDetails, getTVDetails } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminListFilter } from "@/contexts/AdminListFilterContext";
import { mergeDbAndTmdb } from "@/lib/mergeDbAndTmdb";
import { isIndianScope } from "@/lib/contentScope";

type IndianLang = "all" | "ta" | "te" | "hi";

const INDIAN_LANGS: Array<{ key: IndianLang; label: string; tmdbLang?: string }> = [
  { key: "all", label: "All" },
  { key: "ta", label: "Tamil", tmdbLang: "ta" },
  { key: "te", label: "Telugu", tmdbLang: "te" },
  { key: "hi", label: "Bollywood", tmdbLang: "hi" },
];

const BATCH_SIZE = 18;

type DbEntry = {
  id: string;
  type: "movie" | "series";
  genre_ids?: number[] | null;
  release_year?: number | null;
  title?: string | null;
};

const Indian = () => {
  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  const {
    getAvailability,
    getDbMetaByKey,
    entries: dbEntries,
    metaByKey,
    isLoading: isAvailabilityLoading,
  } = useEntryAvailability();

  const [items, setItems] = useState<Movie[]>([]);
  const [dbOnlyHydrated, setDbOnlyHydrated] = useState<Movie[]>([]);
  const [displayCount, setDisplayCount] = useState(0);
  const [animateFromIndex, setAnimateFromIndex] = useState<number | null>(null);
  const [pendingLoadMore, setPendingLoadMore] = useState(false);
  const loadMoreFetchRequestedRef = useRef(false);

  const [selectedLang, setSelectedLang] = useState<IndianLang>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useMinDurationLoading(600);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const restoreScrollYRef = useRef<number | null>(null);

  const dbHydrationCursorRef = useRef(0);

  const getKey = useCallback((m: Pick<Movie, "id" | "media_type" | "first_air_date">) => {
    const media = (m.media_type as "movie" | "tv" | undefined) ?? (m.first_air_date ? "tv" : "movie");
    return `${m.id}-${media}`;
  }, []);

  const normalizedDbEntries = useMemo(() => (dbEntries as unknown as DbEntry[]) ?? [], [dbEntries]);

  const dbEntriesMatchingLanguage = useMemo(() => {
    return normalizedDbEntries.filter((e) => {
      const mediaType = e.type === "series" ? "tv" : "movie";
      const meta = metaByKey.get(`${e.id}-${mediaType}`);
      if (meta?.originalLanguage) {
        return ["hi", "ta", "te"].includes(meta.originalLanguage);
      }
      return false;
    });
  }, [normalizedDbEntries, metaByKey]);

  const dbCandidates = useMemo(() => {
    const out: Array<{ id: number; mediaType: "movie" | "tv"; sortYear: number }> = [];

    for (const e of dbEntriesMatchingLanguage) {
      const id = Number(e.id);
      if (!Number.isFinite(id)) continue;
      const mediaType = e.type === "series" ? ("tv" as const) : ("movie" as const);

      const meta = metaByKey.get(`${id}-${mediaType}`);
      if (!meta) continue;

      const sortYear = (typeof e.release_year === "number" && Number.isFinite(e.release_year) ? e.release_year : null) ??
        (typeof meta.releaseYear === "number" && Number.isFinite(meta.releaseYear) ? meta.releaseYear : null) ??
        0;

      out.push({ id, mediaType, sortYear });
    }

    out.sort((a, b) => b.sortYear - a.sortYear);
    return out;
  }, [dbEntriesMatchingLanguage, metaByKey]);

  const hydrateDbOnly = useCallback(
    async (tmdbKeys: Set<string>, limit: number) => {
      if (metaByKey.size === 0) return;

      const hydratedKeys = new Set(dbOnlyHydrated.map((m) => getKey(m)));
      const toHydrate: Array<{ id: number; mediaType: "movie" | "tv" }> = [];

      let cursor = dbHydrationCursorRef.current;
      while (cursor < dbCandidates.length && toHydrate.length < limit) {
        const c = dbCandidates[cursor];
        cursor += 1;

        const key = `${c.id}-${c.mediaType}`;
        if (tmdbKeys.has(key)) continue;
        if (hydratedKeys.has(key)) continue;

        toHydrate.push({ id: c.id, mediaType: c.mediaType });
      }
      dbHydrationCursorRef.current = cursor;

      if (toHydrate.length === 0) return;

      const BATCH = 5;
      const results: Movie[] = [];

      for (let i = 0; i < toHydrate.length; i += BATCH) {
        const batch = toHydrate.slice(i, i + BATCH);
        const hydrated = await Promise.all(
          batch.map(async ({ id, mediaType }) => {
            try {
              if (mediaType === "movie") {
                const d = await getMovieDetails(id);
                return { ...d, media_type: "movie" as const } as Movie;
              }
              const d = await getTVDetails(id);
              return { ...d, media_type: "tv" as const } as Movie;
            } catch {
              return null;
            }
          })
        );

        const cleaned = (hydrated.filter(Boolean) as Movie[]).filter(isIndianScope);
        results.push(...(await filterAdultContentStrict(cleaned)));
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
      tmdbItems: items,
      dbOnlyHydratedItems: dbOnlyHydrated,
      isDbItem: (key) => metaByKey.has(key),
      getDbMeta: getDbMetaByKey,
    });
  }, [dbOnlyHydrated, getDbMetaByKey, items, metaByKey]);

  const baseVisible = useMemo(
    () => filterBlockedPosts(mergedBase),
    [filterBlockedPosts, mergedBase]
  );

  const visibleItems = useMemo(() => {
    return isAdmin && showOnlyDbLinked
      ? baseVisible.filter((it) => {
          const a = getAvailability(it.id);
          return a.hasWatch || a.hasDownload;
        })
      : baseVisible;
  }, [baseVisible, getAvailability, isAdmin, showOnlyDbLinked]);

  // Preload hover images in the background ONLY (never gate the grid render on this).
  usePageHoverPreload(visibleItems, { enabled: !isLoading });

  // Only show skeletons before we have any real items to render.
  const pageIsLoading = visibleItems.length === 0 && (isLoading || isModerationLoading || isAvailabilityLoading);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { saveCache, getCache } = useListStateCache<Movie>();

  // Restore from cache on mount
  useEffect(() => {
    const cached = getCache(selectedLang, []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Save cache before unmount / route change
  useEffect(() => {
    return () => {
      if (items.length > 0) {
        saveCache({
          items,
          page,
          hasMore,
          activeTab: selectedLang,
          selectedFilters: [],
        });
      }
    };
  }, [items, page, hasMore, selectedLang, saveCache]);

  const fetchIndian = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (reset) {
        setIsLoading(true);
        setDbOnlyHydrated([]);
        dbHydrationCursorRef.current = 0;
      } else {
        setIsLoadingMore(true);
      }

      try {
        const today = new Date().toISOString().split("T")[0];

        const langsToFetch =
          selectedLang === "all"
            ? INDIAN_LANGS.filter((l) => l.key !== "all").map((l) => l.tmdbLang!)
            : [INDIAN_LANGS.find((l) => l.key === selectedLang)?.tmdbLang!].filter(Boolean);

        const buildMovieParams = (lang: string) =>
          new URLSearchParams({
            api_key: "fc6d85b3839330e3458701b975195487",
            include_adult: "false",
            page: pageNum.toString(),
            // Latest → old
            sort_by: "primary_release_date.desc",
            with_origin_country: "IN",
            with_original_language: lang,
            // Don’t hide content behind “popular/top rated” thresholds, but also avoid unrated items.
            "vote_count.gte": "1",
            "vote_average.gte": "1",
            "primary_release_date.lte": today,
          });

        const buildTvParams = (lang: string) =>
          new URLSearchParams({
            api_key: "fc6d85b3839330e3458701b975195487",
            include_adult: "false",
            page: pageNum.toString(),
            // Latest → old
            sort_by: "first_air_date.desc",
            with_origin_country: "IN",
            with_original_language: lang,
            "vote_count.gte": "1",
            "vote_average.gte": "1",
            "first_air_date.lte": today,
          });

        // Fetch movies+tv for each language in parallel
        const requests = langsToFetch.flatMap((lang) => [
          fetch(`https://api.themoviedb.org/3/discover/movie?${buildMovieParams(lang)}`),
          fetch(`https://api.themoviedb.org/3/discover/tv?${buildTvParams(lang)}`),
        ]);

        const responses = await Promise.all(requests);
        const jsons = await Promise.all(responses.map((r) => r.json()));

        // Combine results (movie/tv alternates in jsons)
        const combined = jsons.flatMap((data, idx) => {
          const isMovie = idx % 2 === 0;
          const mediaType = isMovie ? ("movie" as const) : ("tv" as const);
          return (data?.results || []).map((m: Movie) => ({ ...m, media_type: mediaType }));
        });

        const combinedResults: Movie[] = await filterAdultContentStrict(combined);

        // Sort by release/air date desc
        const sortedResults = combinedResults.sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || "";
          const dateB = b.release_date || b.first_air_date || "";
          return dateB.localeCompare(dateA);
        });

        const visibleResults = filterBlockedPosts(sortedResults);

        // Hydrate DB-only items BEFORE first reveal (prevents reorder jumps)
        if (reset && metaByKey.size > 0) {
          const tmdbKeys = new Set(
            visibleResults.map((m) => getKey(m))
          );
          await hydrateDbOnly(tmdbKeys, 36);
        }

        if (reset) {
          setItems(visibleResults);
          setDisplayCount(BATCH_SIZE);
        } else {
          setItems((prev) => {
            const existingKeys = new Set(prev.map((item) => `${item.id}-${item.media_type}`));
            const newItems = visibleResults.filter((item) => !existingKeys.has(`${item.id}-${item.media_type}`));
            return [...prev, ...newItems];
          });

          if (loadMoreFetchRequestedRef.current) {
            loadMoreFetchRequestedRef.current = false;
            setDisplayCount((prev) => prev + BATCH_SIZE);
          }
        }

        // Determine pagination
        const totalPages = jsons.map((d) => Number(d?.total_pages || 0));
        const maxPages = Math.max(...totalPages, 0);
        setHasMore(pageNum < maxPages);
      } catch (error) {
        console.error("Failed to fetch Indian content:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedLang, setIsLoadingMore, filterBlockedPosts, getKey, hydrateDbOnly, metaByKey.size]
  );

  // Reset and fetch when language changes
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
    fetchIndian(1, true);
  }, [selectedLang, isInitialized, fetchIndian, isRestoredFromCache]);

  // Tell global loader it can stop as soon as we have real content on screen.
  useEffect(() => {
    if (!pageIsLoading && visibleItems.length > 0) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("route:content-ready")));
    }
  }, [pageIsLoading, visibleItems.length]);

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

  // Resolve pending "load more": reveal from buffer first, otherwise fetch next TMDB page.
  useEffect(() => {
    if (!pendingLoadMore) return;

    const hasBuffered = displayCount < visibleItems.length;
    if (hasBuffered) {
      setAnimateFromIndex(displayCount);
      setDisplayCount((prev) => Math.min(prev + BATCH_SIZE, visibleItems.length));
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
          const tmdbKeys = new Set(items.map((m) => getKey(m)));
          await hydrateDbOnly(tmdbKeys, 36);
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
  }, [pendingLoadMore, displayCount, visibleItems.length, hasMore, setIsLoadingMore, dbCandidates.length, getKey, hydrateDbOnly, items]);

  // Fetch more when page changes
  useEffect(() => {
    if (page > 1 && !isRestoredFromCache) {
      fetchIndian(page, false);
    }
  }, [page, fetchIndian, isRestoredFromCache]);

  return (
    <>
      <Helmet>
        <title>Indian - DanieWatch</title>
        <meta
          name="description"
          content="Tamil, Telugu and Bollywood movies & TV sorted from latest to oldest with infinite scroll."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="sr-only">Indian</h1>

          {/* Language chips */}
          <div className="mb-8 flex flex-wrap gap-2">
            {INDIAN_LANGS.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setSelectedLang(l.key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-colors",
                  l.key === selectedLang
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/30 text-foreground border-border hover:bg-secondary/50"
                )}
              >
                {l.label}
              </button>
            ))}
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
                    <div key={`${item.id}-${item.media_type}`} className={shouldAnimate ? "animate-fly-in" : undefined}>
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

          {/* No results */}
          {!pageIsLoading && visibleItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No results found.</p>
            </div>
          )}

          {/* Load more sentinel (stop quietly at end) */}
          <div ref={loadMoreRef} className="flex justify-center py-6">
            {isLoadingMore && <InlineDotsLoader ariaLabel="Loading more" />}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Indian;

