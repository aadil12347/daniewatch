import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Movie, filterAdultContentStrict, getMovieDetails, getPosterUrl, getTVDetails } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useDbManifest } from "@/hooks/useDbManifest";
import { isKoreanScope, isAnimeScope, KOREAN_LANGS } from "@/lib/contentScope";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { BiDirectionalRecyclingPosterGrid } from "@/components/virtualization/BiDirectionalRecyclingPosterGrid";
import { queuePriorityCache } from "@/lib/priorityCacheBridge";

// Korean content genres (for both movies and TV)
const KOREAN_TAGS = [
  { id: "romance", label: "Romance", genreId: 10749 },
  { id: "drama", label: "Drama", genreId: 18 },
  { id: "comedy", label: "Comedy", genreId: 35 },
  { id: "action", label: "Action", genreId: 28 },
  { id: "mystery", label: "Mystery", genreId: 9648 },
  { id: "fantasy", label: "Fantasy", genreId: 14 },
  { id: "crime", label: "Crime", genreId: 80 },
  { id: "family", label: "Family", genreId: 10751 },
];

// Action genre ID for TV is different
const TV_ACTION_GENRE = 10759;
const TV_FANTASY_GENRE = 10765;

const BATCH_SIZE = 18;
const INITIAL_REVEAL_COUNT = 24;

// TMDB fetching for the Korean page excludes Turkish. We still allow Turkish DB entries
// (manifest-driven) to appear if they exist in the database.
const TMDB_KOREAN_LANGS = ["ko", "zh"] as const;

const Korean = () => {
  const { filterBlockedPosts, sortWithPinnedFirst, isLoading: isModerationLoading } = usePostModeration();
  
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
  const [tmdbMaxPages, setTmdbMaxPages] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const restoreScrollYRef = useRef<number | null>(null);

  const dbHydrationCursorRef = useRef(0);

  const getKey = useCallback((m: Pick<Movie, "id" | "media_type" | "first_air_date">) => {
    const media = (m.media_type as "movie" | "tv" | undefined) ?? (m.first_air_date ? "tv" : "movie");
    return `${m.id}-${media}`;
  }, []);

  const normalizedDbGenreSet = useMemo(() => {
    // For DB metadata filtering, allow TV equivalents for Action/Fantasy tags.
    const s = new Set<number>(selectedTags);
    if (selectedTags.includes(28)) s.add(TV_ACTION_GENRE);
    if (selectedTags.includes(14)) s.add(TV_FANTASY_GENRE);
    return s;
  }, [selectedTags]);

  // Build DB entries from manifest - no filtering here, we want ALL DB items to appear first
  // Filters will be applied to the final merged list after DB-first ordering
  const dbEntriesMatchingFilters = useMemo(() => {
    return manifestItems;
  }, [manifestItems]);

  const dbCandidates = useMemo(() => {
    const allowedCountries = new Set(["KR", "CN", "TW", "HK", "TR"]);
    const out: Array<{ id: number; mediaType: "movie" | "tv"; sortYear: number; hasLinks: boolean }> = [];

    for (const item of dbEntriesMatchingFilters) {
      const mediaType = item.media_type;
      const id = item.id;
      if (!Number.isFinite(id)) continue;

      const lang = item.original_language ?? null;
      const origin = item.origin_country ?? null;

      const inLang = !!lang && (KOREAN_LANGS as readonly string[]).includes(lang);
      const inCountry = Array.isArray(origin) && origin.some((c) => allowedCountries.has(c));

      // Korean page scope + anime exclusion
      if (!(inLang || inCountry)) continue;
      if (lang === "ja" && item.genre_ids?.includes(16)) continue;

      const sortYear = item.release_year ?? 0;
      const hasLinks = item.hasWatch || item.hasDownload;

      out.push({ id, mediaType, sortYear, hasLinks });
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

        const cleaned = hydrated.filter(Boolean) as Movie[];
        const strict = await filterAdultContentStrict(cleaned);
        results.push(...strict.filter((m) => isKoreanScope(m) && !isAnimeScope(m)));
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

  const hydratedByKey = useMemo(() => {
    const byKey = new Map<string, Movie>();
    for (const m of items) byKey.set(getKey(m), m);
    for (const m of dbOnlyHydrated) byKey.set(getKey(m), m);
    return byKey;
  }, [dbOnlyHydrated, getKey, items]);

  // DB stubs: every scoped DB item exists in the list immediately.
  // Hydration only upgrades stubs "in place" (no reordering/teleport).
  const dbStubItems = useMemo(() => {
    return dbCandidates.map((c) => {
      const key = `${c.id}-${c.mediaType}`;
      const meta = manifestMetaByKey.get(key);
      const title = meta?.title ?? "";
      const releaseYear = meta?.releaseYear ?? null;

      const base: Partial<Movie> = {
        id: c.id,
        media_type: c.mediaType,
        // poster_path is allowed to be a FULL URL now (getImageUrl/getPosterUrl will pass it through).
        poster_path: meta?.posterUrl ?? null,
        genre_ids: meta?.genreIds ?? [],
        vote_average: meta?.voteAverage ?? 0,
        logo_url: meta?.logoUrl ?? null,
      };

      if (c.mediaType === "movie") {
        (base as any).title = title;
        (base as any).release_date = releaseYear ? `${releaseYear}-01-01` : "";
      } else {
        (base as any).name = title;
        (base as any).first_air_date = releaseYear ? `${releaseYear}-01-01` : "";
      }

      return base as Movie;
    });
  }, [dbCandidates, manifestMetaByKey]);

  const dbVisibleItems = useMemo(() => {
    const replaced = dbStubItems.map((stub) => {
      const k = getKey(stub);
      return hydratedByKey.get(k) ?? stub;
    });

    const safe = filterBlockedPosts(replaced);
    return sortWithPinnedFirst(safe, "korean", undefined);
  }, [dbStubItems, filterBlockedPosts, getKey, hydratedByKey, sortWithPinnedFirst]);

  const tmdbOnlyVisibleItems = useMemo(() => {
    const dbKeys = new Set(dbCandidates.map((c) => `${c.id}-${c.mediaType}`));
    const tmdbOnly = items.filter((m) => !dbKeys.has(getKey(m)));
    const safe = filterBlockedPosts(tmdbOnly);
    return sortWithPinnedFirst(safe, "korean", undefined);
  }, [dbCandidates, filterBlockedPosts, getKey, items, sortWithPinnedFirst]);

  // Apply genre/year filters, then concatenate (DB first, TMDB after).
  const filteredDbItems = useMemo(() => {
    const base = dbVisibleItems;

    if (normalizedDbGenreSet.size === 0 && !selectedYear) return base;

    return base.filter((item) => {
      const genreIds = item.genre_ids ?? [];
      const dateStr = item.release_date || item.first_air_date || "";
      const year = dateStr ? parseInt(dateStr.slice(0, 4)) : null;

      if (normalizedDbGenreSet.size > 0) {
        const hasOverlap = genreIds.some((g) => normalizedDbGenreSet.has(g));
        if (!hasOverlap) return false;
      }

      if (selectedYear) {
        if (selectedYear === "older") {
          if (typeof year !== "number" || year > 2019) return false;
        } else {
          if (typeof year !== "number" || String(year) !== selectedYear) return false;
        }
      }

      return true;
    });
  }, [dbVisibleItems, normalizedDbGenreSet, selectedYear]);

  const filteredTmdbItems = useMemo(() => {
    const base = tmdbOnlyVisibleItems;

    if (normalizedDbGenreSet.size === 0 && !selectedYear) return base;

    return base.filter((item) => {
      const genreIds = item.genre_ids ?? [];
      const dateStr = item.release_date || item.first_air_date || "";
      const year = dateStr ? parseInt(dateStr.slice(0, 4)) : null;

      if (normalizedDbGenreSet.size > 0) {
        const hasOverlap = genreIds.some((g) => normalizedDbGenreSet.has(g));
        if (!hasOverlap) return false;
      }

      if (selectedYear) {
        if (selectedYear === "older") {
          if (typeof year !== "number" || year > 2019) return false;
        } else {
          if (typeof year !== "number" || String(year) !== selectedYear) return false;
        }
      }

      return true;
    });
  }, [normalizedDbGenreSet, selectedYear, tmdbOnlyVisibleItems]);

  const filteredVisibleItems = useMemo(() => {
    return [...filteredDbItems, ...filteredTmdbItems];
  }, [filteredDbItems, filteredTmdbItems]);

  // Preload hover images in the background ONLY (never gate the grid render on this).
  usePageHoverPreload(filteredVisibleItems, { enabled: !isLoading });

  // Only show skeletons before we have any real items to render.
  const pageIsLoading = filteredVisibleItems.length === 0 && (isLoading || isModerationLoading || isManifestLoading);

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

  const fetchKorean = useCallback(
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

        // Build genre params - handle action/fantasy genre difference for TV
        const movieGenres = selectedTags.join(",");
        const tvGenres = selectedTags
          .map((g) => {
            if (g === 28) return TV_ACTION_GENRE;
            if (g === 14) return TV_FANTASY_GENRE;
            return g;
          })
          .join(",");

        const makeMovieParams = (lang: string) => {
          const p = new URLSearchParams({
            api_key: "fc6d85b3839330e3458701b975195487",
            include_adult: "false",
            page: pageNum.toString(),
            sort_by: "primary_release_date.desc",
            with_original_language: lang,
            "vote_count.gte": "50",
            "primary_release_date.lte": today,
          });

          if (selectedYear) {
            if (selectedYear === "older") {
              p.set("primary_release_date.lte", "2019-12-31");
            } else {
              p.set("primary_release_year", selectedYear);
            }
          }

          if (selectedTags.length > 0) {
            p.set("with_genres", movieGenres);
          }

          return p;
        };

        const makeTvParams = (lang: string) => {
          const p = new URLSearchParams({
            api_key: "fc6d85b3839330e3458701b975195487",
            include_adult: "false",
            page: pageNum.toString(),
            sort_by: "first_air_date.desc",
            with_original_language: lang,
            "vote_count.gte": "20",
            "first_air_date.lte": today,
          });

          if (selectedYear) {
            if (selectedYear === "older") {
              p.set("first_air_date.lte", "2019-12-31");
            } else {
              p.set("first_air_date_year", selectedYear);
            }
          }

          if (selectedTags.length > 0) {
            p.set("with_genres", tvGenres);
          }

          return p;
        };

        // Fetch movies + TV for Korean/Chinese in parallel (exclude Turkish from TMDB).
        const movieUrls = TMDB_KOREAN_LANGS.map((lang) => `https://api.themoviedb.org/3/discover/movie?${makeMovieParams(lang)}`);
        const tvUrls = TMDB_KOREAN_LANGS.map((lang) => `https://api.themoviedb.org/3/discover/tv?${makeTvParams(lang)}`);

        const responses = await Promise.all([...movieUrls, ...tvUrls].map((u) => fetch(u)));
        const json = await Promise.all(responses.map((r) => r.json()));

        const movieJson = json.slice(0, movieUrls.length);
        const tvJson = json.slice(movieUrls.length);

        const combined = [
          ...movieJson.flatMap((d: any) => (d?.results || []).map((m: Movie) => ({ ...m, media_type: "movie" as const }))),
          ...tvJson.flatMap((d: any) => (d?.results || []).map((t: Movie) => ({ ...t, media_type: "tv" as const }))),
        ];

        const combinedResults = (await filterAdultContentStrict(combined)).filter((m) => {
          // Safety: never show Turkish TMDB results on this page.
          const lang = (m as any)?.original_language;
          const origin = (m as any)?.origin_country;
          const isTurkish = lang === "tr" || (Array.isArray(origin) && origin.includes("TR"));
          if (isTurkish) return false;

          return isKoreanScope(m) && !isAnimeScope(m);
        });

        // Sort by release date descending (TMDB fallback ordering only)
        const sortedResults = combinedResults.sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || "";
          const dateB = b.release_date || b.first_air_date || "";
          return dateB.localeCompare(dateA);
        });

        // Hide blocked posts for normal users; admins can toggle show/hide
        const visibleResults = filterBlockedPosts(sortedResults);

        const uniqueVisible = dedupe(visibleResults);

        // Hydrate DB-only items in the background (stubs are already visible; hydration only upgrades in-place)
        if (reset && manifestMetaByKey.size > 0) {
          const tmdbKeys = new Set(uniqueVisible.map((m) => getKey(m)));
          void hydrateDbOnly(tmdbKeys, 60);
        }

        if (reset) {
          setItems(uniqueVisible);
          setDisplayCount(INITIAL_REVEAL_COUNT);
        } else {
          setItems((prev) => dedupe([...prev, ...uniqueVisible]));
          if (loadMoreFetchRequestedRef.current) {
            loadMoreFetchRequestedRef.current = false;
            setDisplayCount((prev) => prev + BATCH_SIZE);
          }
        }

        // Has more if any of the language feeds still has pages
        const maxPages = Math.max(
          0,
          ...movieJson.map((d: any) => Number(d?.total_pages) || 0),
          ...tvJson.map((d: any) => Number(d?.total_pages) || 0)
        );
        setTmdbMaxPages(maxPages);
        setHasMore(pageNum < maxPages);
      } catch (error) {
        console.error("Failed to fetch Korean content:", error);
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
    fetchKorean(1, true);
  }, [selectedTags, selectedYear, isInitialized]);

  // Keep the global fullscreen loader until the first 24 tiles are actually visible.
  const routeReady =
    !pageIsLoading &&
    (filteredVisibleItems.length === 0 || displayCount >= Math.min(INITIAL_REVEAL_COUNT, filteredVisibleItems.length));
  useRouteContentReady(routeReady);

  const onNeedMoreData = useCallback(() => {
    if (isLoading || isLoadingMore || pendingLoadMore) return;

    const hasBuffered = displayCount < filteredVisibleItems.length;
    if (!hasBuffered && !hasMore) return;

    setPendingLoadMore(true);
  }, [displayCount, filteredVisibleItems.length, hasMore, isLoading, isLoadingMore, pendingLoadMore]);

  // Resolve pending "load more": reveal from buffer first; ONLY fetch TMDB after DB section is fully revealed.
  useEffect(() => {
    if (!pendingLoadMore) return;

    const hasBuffered = displayCount < filteredVisibleItems.length;
    if (hasBuffered) {
      setAnimateFromIndex(displayCount);
      setDisplayCount((prev) => Math.min(prev + BATCH_SIZE, filteredVisibleItems.length));

      // While we're still in the DB section, hydrate ahead in the background (no waiting, no reordering).
      if (displayCount < filteredDbItems.length) {
        const tmdbKeys = new Set(items.map((m) => getKey(m)));
        void hydrateDbOnly(tmdbKeys, 30);
      }

      setPendingLoadMore(false);
      return;
    }

    // No buffered items left.
    // STRICT RULE: Do not fetch/show TMDB-only items until the DB section is completely revealed.
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
  }, [pendingLoadMore, displayCount, filteredVisibleItems.length, filteredDbItems.length, hasMore, setIsLoadingMore, getKey, hydrateDbOnly, items]);

  // Fetch more when page changes
  useEffect(() => {
    if (page > 1 && !isRestoredFromCache) {
      fetchKorean(page);
    }
  }, [page, fetchKorean, isRestoredFromCache]);

  // Permanently cache the top posters for instant back-scroll/revisit.
  useEffect(() => {
    if (pageIsLoading) return;
    const top = filteredVisibleItems.slice(0, 10);
    const posterUrls = top
      .map((m) => getPosterUrl((m as any)?.poster_path ?? null, "w342"))
      .filter(Boolean) as string[];
    queuePriorityCache("/korean", posterUrls);
  }, [filteredVisibleItems, pageIsLoading]);

  const shownItems = useMemo(() => {
    return filteredVisibleItems.slice(0, Math.min(displayCount, filteredVisibleItems.length));
  }, [displayCount, filteredVisibleItems]);

  const totalItemCount = useMemo(() => {
    // Hybrid: DB partition exact + TMDB partition upper-bound based on total_pages (across ko/zh and movie/tv).
    const tmdbItemsPerPageUpper = 20 * TMDB_KOREAN_LANGS.length * 2;
    const estimated = filteredDbItems.length + Math.max(0, tmdbMaxPages) * tmdbItemsPerPageUpper;

    // Avoid trailing skeleton forever once we know we're done.
    const clampTo = !hasMore ? filteredVisibleItems.length : estimated;
    return Math.max(clampTo, shownItems.length);
  }, [filteredDbItems.length, filteredVisibleItems.length, hasMore, shownItems.length, tmdbMaxPages]);

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
  const genresForNav = KOREAN_TAGS.map((tag) => ({ id: tag.genreId, name: tag.label }));

  return (
    <>
      <Helmet>
        <title>Korean Movies & TV - DanieWatch</title>
        <meta
          name="description"
          content="Watch the best Korean movies and TV series sorted by latest release. Filter by genre and year."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-6 pb-8">
          <h1 className="sr-only">Korean</h1>

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
          {pageIsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
              {Array.from({ length: BATCH_SIZE }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-[2/3] rounded-xl animate-none" />
                  <Skeleton className="h-4 w-3/4 mt-3 animate-none" />
                  <Skeleton className="h-3 w-1/2 mt-2 animate-none" />
                </div>
              ))}
            </div>
          ) : (
            <BiDirectionalRecyclingPosterGrid
              items={shownItems}
              totalItemCount={totalItemCount}
              futureBufferPx={1000}
              onNeedMoreData={onNeedMoreData}
              renderItem={(item, index) => {
                if (!item) {
                  return (
                    <div>
                      <Skeleton className="aspect-[2/3] rounded-xl animate-none" />
                      <Skeleton className="h-4 w-3/4 mt-3 animate-none" />
                      <Skeleton className="h-3 w-1/2 mt-2 animate-none" />
                    </div>
                  );
                }

                const shouldAnimate =
                  animateFromIndex !== null && index >= animateFromIndex && index < animateFromIndex + BATCH_SIZE;

                return (
                  <div className={shouldAnimate ? "animate-fly-in" : undefined}>
                    <MovieCard
                      movie={item}
                      animationDelay={Math.min(index * 30, 300)}
                      enableReveal={false}
                      enableHoverPortal={false}
                    />
                  </div>
                );
              }}
            />
          )}

          {/* No results message */}
          {!pageIsLoading && filteredVisibleItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No Korean content found with the selected filters.</p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Loading More Indicator */}
          <div className="flex justify-center py-6">
            {isLoadingMore && <InlineDotsLoader ariaLabel="Loading more" />}
            {!hasMore && filteredVisibleItems.length > 0 && <p className="text-muted-foreground">You've reached the end</p>}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Korean;

