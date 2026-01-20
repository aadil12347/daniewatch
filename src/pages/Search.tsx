import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search as SearchIcon } from "lucide-react";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePostModeration } from "@/hooks/usePostModeration";
import { searchMulti, filterMinimal, getMovieDetails, getTVDetails, Movie } from "@/lib/tmdb";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminListFilter } from "@/contexts/AdminListFilterContext";
import { useListStateCache } from "@/hooks/useListStateCache";
import { mergeDbAndTmdb } from "@/lib/mergeDbAndTmdb";

type DbEntry = {
  id: string;
  type: "movie" | "series";
  genre_ids?: number[] | null;
  release_year?: number | null;
  title?: string | null;
};

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const refreshKey = searchParams.get("t") || "";

  const [results, setResults] = useState<Movie[]>([]);
  const [dbOnlyHydrated, setDbOnlyHydrated] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const requestIdRef = useRef(0);
  const restoredKeyRef = useRef<string | null>(null);
  const restoreScrollYRef = useRef<number | null>(null);

  const { saveCache, getCache } = useListStateCache<Movie>({ includeSearch: true });

  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  const {
    entries: dbEntries,
    metaByKey,
    getDbMetaByKey,
    getAvailability,
    isLoading: isAvailabilityLoading,
  } = useEntryAvailability();

  const mergedBase = useMemo(() => {
    return mergeDbAndTmdb({
      tmdbItems: results,
      dbOnlyHydratedItems: dbOnlyHydrated,
      isDbItem: (key) => metaByKey.has(key),
      getDbMeta: getDbMetaByKey,
    });
  }, [dbOnlyHydrated, getDbMetaByKey, metaByKey, results]);

  const visibleResults = useMemo(() => {
    const base = filterBlockedPosts(mergedBase);

    return isAdmin && showOnlyDbLinked
      ? base.filter((it) => {
          const a = getAvailability(it.id);
          return a.hasWatch || a.hasDownload;
        })
      : base;
  }, [filterBlockedPosts, getAvailability, isAdmin, mergedBase, showOnlyDbLinked]);

  // Preload hover images in the background ONLY (never gate the search grid on this).
  usePageHoverPreload(visibleResults, { enabled: !isLoading });

  // Only show skeletons before we have any real results to render.
  const pageIsLoading = visibleResults.length === 0 && (isLoading || isModerationLoading || isAvailabilityLoading);

  // Restore cached results+scroll for this exact query on mount.
  useEffect(() => {
    const key = query;

    if (!query.trim()) {
      restoredKeyRef.current = null;
      restoreScrollYRef.current = null;
      return;
    }

    const cached = getCache("all", []);
    if (!cached) return;

    restoredKeyRef.current = key;
    restoreScrollYRef.current = cached.scrollY ?? 0;
    setResults(cached.items);
    setIsLoading(false);
  }, [getCache, query]);

  // Restore scroll AFTER results render.
  useEffect(() => {
    if (restoreScrollYRef.current === null) return;
    if (results.length === 0) return;

    const y = restoreScrollYRef.current;
    restoreScrollYRef.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    });
  }, [results.length]);

  // Save results+scroll so the list state survives full refresh.
  useEffect(() => {
    if (!query.trim()) return;

    return () => {
      saveCache({
        items: results,
        page: 1,
        hasMore: false,
        activeTab: "all",
        selectedFilters: [],
      });
    };
  }, [saveCache, results, query]);

  useEffect(() => {
    const key = query;

    // If we just restored this exact state and no explicit refresh was requested, keep it.
    if (restoredKeyRef.current === key && !refreshKey) {
      restoredKeyRef.current = null;
      return;
    }

    // Increment request id so late responses from older searches can't overwrite new results
    const requestId = ++requestIdRef.current;

    // Always clear results and show loading state for a fresh search
    setResults([]);
    setDbOnlyHydrated([]);
    setIsLoading(true);

    const fetchResults = async () => {
      if (!query.trim()) {
        if (requestId === requestIdRef.current) setIsLoading(false);
        return;
      }

      try {
        // Requirement: no category restrictions; always use multi search
        const response = await searchMulti(query);

        if (requestId !== requestIdRef.current) return;

        const baseResults = filterMinimal(
          response.results.filter((item) => item.media_type === "movie" || item.media_type === "tv")
        );

        setResults(baseResults);

        // DB title matches (DB-first), hydrate a small set for card display
        const entries = (dbEntries as unknown as DbEntry[]) ?? [];
        const q = query.trim().toLowerCase();
        const matches = entries
          .filter((e) => (e.title || "").toLowerCase().includes(q))
          .slice(0, 30)
          .map((e) => ({ id: Number(e.id), mediaType: e.type === "series" ? ("tv" as const) : ("movie" as const) }))
          .filter((m) => Number.isFinite(m.id));

        const tmdbKeys = new Set(baseResults.map((m) => `${m.id}-${m.media_type}`));
        const toHydrate = matches.filter((m) => !tmdbKeys.has(`${m.id}-${m.mediaType}`)).slice(0, 25);

        const BATCH = 5;
        const hydrated: Movie[] = [];
        for (let i = 0; i < toHydrate.length; i += BATCH) {
          const batch = toHydrate.slice(i, i + BATCH);
          const part = await Promise.all(
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
          hydrated.push(...(part.filter(Boolean) as Movie[]));
        }

        if (requestId !== requestIdRef.current) return;
        setDbOnlyHydrated(hydrated);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Search failed:", error);
        setResults([]);
        setDbOnlyHydrated([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchResults();
  }, [query, refreshKey, getCache, dbEntries]);

  return (
    <>
      <Helmet>
        <title>{query ? `Search: ${query}` : "Search"} - DanieWatch</title>
        <meta name="description" content={`Search results for ${query}`} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-24 pb-8">
          {query ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">Search Results for "{query}"</h1>
              </div>
              <p className="text-muted-foreground mb-8">
                {pageIsLoading ? "Searching..." : `Found ${visibleResults.length} results`}
              </p>
            </>
          ) : (
            <div className="text-center py-20">
              <SearchIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Search Movies & TV Shows</h1>
              <p className="text-muted-foreground">Use the search bar above to find your favorite content</p>
            </div>
          )}

          {/* Results Grid */}
          {(pageIsLoading || visibleResults.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
              {pageIsLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <div key={i}>
                      <Skeleton className="aspect-[2/3] rounded-xl animate-none" />
                      <Skeleton className="h-4 w-3/4 mt-3 animate-none" />
                      <Skeleton className="h-3 w-1/2 mt-2 animate-none" />
                    </div>
                  ))
                : visibleResults.map((item) => (
                    <MovieCard
                      key={`${item.id}-${item.media_type ?? "multi"}`}
                      movie={item}
                      enableReveal={false}
                      enableHoverPortal={false}
                    />
                  ))}
            </div>
          )}

          {/* No Results */}
          {!pageIsLoading && query && visibleResults.length === 0 && (
            <div className="text-center py-20">
              <p className="text-xl text-muted-foreground">No results found for "{query}"</p>
              <p className="text-muted-foreground mt-2">Try searching for something else</p>
            </div>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Search;
