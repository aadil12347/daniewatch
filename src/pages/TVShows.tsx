import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { CategoryNav } from "@/components/CategoryNav";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";

import { getTVGenres, filterAdultContent, Movie, Genre } from "@/lib/tmdb";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useDbManifest } from "@/hooks/useDbManifest";
import { KOREAN_LANGS, INDIAN_LANGS, isAllowedOnTvPage } from "@/lib/contentScope";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { VirtualizedPosterGrid } from "@/components/VirtualizedPosterGrid";

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

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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
      const isIndian = !!lang && (INDIAN_LANGS as readonly string[]).includes(lang);
      const isKorean =
        (!!lang && (KOREAN_LANGS as readonly string[]).includes(lang)) ||
        origin.some((c) => ["KR", "CN", "TW", "HK", "TR"].includes(c));

      if (isAnime || isIndian || isKorean) return false;

      return true;
    });
  }, [manifestItems, selectedGenres, selectedYear]);

  const dbCandidates = useMemo(() => {
    const out: Array<{ id: number; sortYear: number; hasLinks: boolean }> = [];

    for (const item of dbEntriesMatchingFilters) {
      const id = item.id;
      if (!Number.isFinite(id)) continue;

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

  const baseDbVisible = useMemo(() => filterBlockedPosts(dbStubItems, "tv"), [dbStubItems, filterBlockedPosts]);
  const baseTmdbVisible = useMemo(() => filterBlockedPosts(tmdbItems, "tv"), [filterBlockedPosts, tmdbItems]);

  const filteredDbItems = baseDbVisible;
  const filteredTmdbItems = baseTmdbVisible;

  // Hide TMDB section until user exhausts the DB partition.
  const visibleAll = useMemo(() => {
    const dbKeys = new Set(filteredDbItems.map((m) => getKey(m)));
    const tmdbDeduped = filteredTmdbItems.filter((m) => !dbKeys.has(getKey(m)));

    const dbExhausted = displayCount >= filteredDbItems.length;
    return dbExhausted ? [...filteredDbItems, ...tmdbDeduped] : filteredDbItems;
  }, [displayCount, filteredDbItems, filteredTmdbItems, getKey]);

  // Preload hover images in the background ONLY (never gate the grid render on this).
  usePageHoverPreload(visibleAll, { enabled: displayCount > 0 });

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

  // Container-scroll virtualization drives load-more via VirtualizedPosterGrid.onEndReached

  // Resolve pending load more: reveal DB first; only then start fetching TMDB pages.
  useEffect(() => {
    if (!pendingLoadMore) return;

    const hasBuffered = displayCount < visibleAll.length;
    if (hasBuffered) {
      setAnimateFromIndex(displayCount);
      setDisplayCount((prev) => Math.min(prev + BATCH_SIZE, visibleAll.length));
      setPendingLoadMore(false);
      return;
    }

    // Still inside DB partition: don't fetch TMDB yet.
    if (displayCount < filteredDbItems.length) {
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
  }, [displayCount, fetchTmdbPage, filteredDbItems.length, getKey, hasMoreTmdb, pendingLoadMore, tmdbPage, visibleAll.length, setIsLoadingMore]);

  // Reset TMDB state when filters change.
  useEffect(() => {
    setTmdbItems([]);
    setTmdbPage(1);
    setHasMoreTmdb(true);
    setAnimateFromIndex(null);

    // Reset reveal to DB section
    if (!isManifestLoading) {
      setDisplayCount(Math.min(INITIAL_REVEAL_COUNT, filteredDbItems.length));
    } else {
      setDisplayCount(0);
    }
  }, [selectedGenres, selectedYear, filteredDbItems.length, isManifestLoading]);

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
    !pageIsLoading && (visibleAll.length === 0 || displayCount >= Math.min(INITIAL_REVEAL_COUNT, visibleAll.length));
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

          {/* Virtualized container-scroll grid */}
          <div className="mt-2" style={{ height: "calc(100vh - 260px)", minHeight: 420 }}>
            <VirtualizedPosterGrid
              items={pageIsLoading ? [] : visibleAll.slice(0, displayCount)}
              isLoading={pageIsLoading || displayCount === 0}
              skeletonCount={BATCH_SIZE}
              onEndReached={() => {
                if (pageIsLoading) return;
                if (isLoadingMore || pendingLoadMore) return;

                const hasBuffered = displayCount < visibleAll.length;
                if (!hasBuffered && !hasMoreTmdb) return;

                setPendingLoadMore(true);
              }}
            />
          </div>

          {/* No results message */}
          {!pageIsLoading && visibleAll.length === 0 && (
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
          <div ref={loadMoreRef} className="flex justify-center py-6">
            {isLoadingMore && <InlineDotsLoader ariaLabel="Loading more" />}
            {!hasMoreTmdb && displayCount >= visibleAll.length && visibleAll.length > 0 && (
              <p className="text-muted-foreground">You've reached the end</p>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default TVShows;
