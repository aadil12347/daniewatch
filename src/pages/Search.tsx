import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search as SearchIcon } from "lucide-react";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePostModeration } from "@/hooks/usePostModeration";
import { filterMinimal, Movie, searchAnimeScoped, searchKoreanScoped, searchMergedGlobal } from "@/lib/tmdb";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useListStateCache } from "@/hooks/useListStateCache";
import { useDbManifest } from "@/hooks/useDbManifest";

const MAX_DB_MATCHES = 60;

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const refreshKey = searchParams.get("t") || "";

  const [tmdbResults, setTmdbResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const requestIdRef = useRef(0);
  const restoredKeyRef = useRef<string | null>(null);
  const restoreScrollYRef = useRef<number | null>(null);

  const { saveCache, getCache } = useListStateCache<Movie>({ includeSearch: true });

  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();

  const { items: manifestItems, isLoading: isManifestLoading } = useDbManifest();

  // DB-first matches come from the manifest (fast + complete posters/logos/ratings)
  const dbStubMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Movie[];

    const matches = manifestItems
      .filter((it) => {
        const title = (it.title ?? "").toLowerCase();
        return title.includes(q);
      })
      .slice(0, MAX_DB_MATCHES)
      .map((it) => {
        const isTv = it.media_type === "tv";
        const title = it.title ?? "Untitled";
        const releaseYear = it.release_year ?? null;

        return {
          id: it.id,
          media_type: isTv ? ("tv" as const) : ("movie" as const),
          ...(isTv ? { name: title, original_name: title, first_air_date: releaseYear ? `${releaseYear}-01-01` : "" } : {}),
          ...(!isTv ? { title, original_title: title, release_date: releaseYear ? `${releaseYear}-01-01` : "" } : {}),
          genre_ids: it.genre_ids ?? [],
          poster_path: it.poster_url ?? null,
          vote_average: it.vote_average ?? undefined,
          vote_count: it.vote_count ?? undefined,
          logo_url: it.logo_url ?? null,
          backdrop_path: it.backdrop_url ?? undefined,
        } as unknown as Movie;
      });

    return matches;
  }, [manifestItems, query]);

  const visibleResults = useMemo(() => {
    const dbKeys = new Set(dbStubMatches.map((m) => `${m.id}-${m.media_type}`));
    const tmdbFiltered = tmdbResults.filter((m) => !dbKeys.has(`${m.id}-${m.media_type}`));

    // Strict DB-first ordering
    const combined = [...dbStubMatches, ...tmdbFiltered];
    return filterBlockedPosts(combined);
  }, [dbStubMatches, filterBlockedPosts, tmdbResults]);

  // Preload hover images in the background ONLY (never gate the search grid on this).
  usePageHoverPreload(visibleResults, { enabled: !isLoading });

  // Only show skeletons before we have any real results to render.
  const pageIsLoading = visibleResults.length === 0 && (isLoading || isModerationLoading || isManifestLoading);

  // Restore cached results+scroll for this exact query on mount.
  useEffect(() => {
    const key = `${category}|${query}`;

    if (!query.trim()) {
      restoredKeyRef.current = null;
      restoreScrollYRef.current = null;
      return;
    }

    const cached = getCache("all", []);
    if (!cached) return;

    restoredKeyRef.current = key;
    restoreScrollYRef.current = cached.scrollY ?? 0;
    setTmdbResults(cached.items);
    setIsLoading(false);
  }, [getCache, query, category]);

  // Restore scroll AFTER results render.
  useEffect(() => {
    if (restoreScrollYRef.current === null) return;
    if (visibleResults.length === 0) return;

    const y = restoreScrollYRef.current;
    restoreScrollYRef.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    });
  }, [visibleResults.length]);

  // Save results+scroll so the list state survives full refresh.
  useEffect(() => {
    if (!query.trim()) return;

    return () => {
      saveCache({
        items: tmdbResults,
        page: 1,
        hasMore: false,
        activeTab: "all",
        selectedFilters: [],
      });
    };
  }, [saveCache, tmdbResults, query]);

  useEffect(() => {
    const key = `${category}|${query}`;

    // If we just restored this exact state and no explicit refresh was requested, keep it.
    if (restoredKeyRef.current === key && !refreshKey) {
      restoredKeyRef.current = null;
      return;
    }

    const requestId = ++requestIdRef.current;

    setTmdbResults([]);
    setIsLoading(true);

    const fetchResults = async () => {
      if (!query.trim()) {
        if (requestId === requestIdRef.current) setIsLoading(false);
        return;
      }

      try {
        const response =
          category === "korean"
            ? await searchKoreanScoped(query)
            : category === "anime"
              ? await searchAnimeScoped(query)
              : await searchMergedGlobal(query);
        if (requestId !== requestIdRef.current) return;

        const baseResults = filterMinimal(
          response.results.filter((item) => item.media_type === "movie" || item.media_type === "tv")
        );

        // TMDB is always secondary; DB matches are rendered first via dbStubMatches.
        setTmdbResults(baseResults);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Search failed:", error);
        setTmdbResults([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchResults();
  }, [query, refreshKey, category]);

  return (
    <>
      <Helmet>
        <title>{query ? `Search: ${query}` : "Search"} - DanieWatch</title>
        <meta name="description" content={query ? `Search results for ${query}` : "Search movies and TV shows"} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-24 pb-8">
          {query ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">Search Results for \"{query}\"</h1>
              </div>
              <p className="text-muted-foreground mb-8">{pageIsLoading ? "Searching..." : `Found ${visibleResults.length} results`}</p>
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
              <p className="text-xl text-muted-foreground">No results found for \"{query}\"</p>
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

