import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search as SearchIcon, Sparkles, Heart } from "lucide-react";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePostModeration } from "@/hooks/usePostModeration";
import { searchMulti, searchAnime, searchKorean, filterMinimal, Movie } from "@/lib/tmdb";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminListFilter } from "@/contexts/AdminListFilterContext";
import { groupDbLinkedFirst } from "@/lib/sortContent";
import { useListStateCache } from "@/hooks/useListStateCache";

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const refreshKey = searchParams.get("t") || "";
  const [results, setResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);
  const restoredKeyRef = useRef<string | null>(null);
  const restoreScrollYRef = useRef<number | null>(null);

  const { saveCache, getCache } = useListStateCache<Movie>({ includeSearch: true });

  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  const { getAvailability, isLoading: isAvailabilityLoading } = useEntryAvailability();

  const visibleResults = useMemo(() => {
    const base = filterBlockedPosts(results);

    // Remove duplicates (TMDB multi search can occasionally return overlapping items)
    const uniqueBase = (() => {
      const seen = new Set<string>();
      return base.filter((it) => {
        const key = `${it.id}-${it.media_type ?? "multi"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })();

    const sorted = groupDbLinkedFirst(uniqueBase, (it) => {
      const a = getAvailability(it.id);
      return a.hasWatch || a.hasDownload;
    });

    return isAdmin && showOnlyDbLinked
      ? sorted.filter((it) => {
          const a = getAvailability(it.id);
          return a.hasWatch || a.hasDownload;
        })
      : sorted;
  }, [filterBlockedPosts, results, getAvailability, isAdmin, showOnlyDbLinked]);

  // Preload hover images in the background ONLY (never gate the search grid on this).
  usePageHoverPreload(visibleResults, { enabled: !isLoading });

  // Only show skeletons before we have any real results to render.
  const pageIsLoading =
    visibleResults.length === 0 && (isLoading || isModerationLoading || isAvailabilityLoading);

  const getCategoryLabel = () => {
    if (category === "anime") return "Anime";
    if (category === "korean") return "Korean";
    return "";
  };

  // Restore cached results+scroll for this exact query/category on mount.
  useEffect(() => {
    const key = `${query}|${category}`;

    if (!query.trim()) {
      restoredKeyRef.current = null;
      restoreScrollYRef.current = null;
      return;
    }

    const cached = getCache(category || "all", []);
    if (!cached) return;

    restoredKeyRef.current = key;
    restoreScrollYRef.current = cached.scrollY ?? 0;
    setResults(cached.items);
    setIsLoading(false);
  }, [getCache, query, category]);

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
        activeTab: category || "all",
        selectedFilters: [],
      });
    };
  }, [saveCache, results, query, category]);

  useEffect(() => {
    const key = `${query}|${category}`;

    // If we just restored this exact state and no explicit refresh was requested, keep it.
    if (restoredKeyRef.current === key && !refreshKey) {
      restoredKeyRef.current = null;
      return;
    }

    // Increment request id so late responses from older searches can't overwrite new results
    const requestId = ++requestIdRef.current;
    console.log("[search] start", { query, category, refreshKey, requestId });

    // Always clear results and show loading state for a fresh search
    setResults([]);
    setIsLoading(true);

    const fetchResults = async () => {
      if (!query.trim()) {
        if (requestId === requestIdRef.current) setIsLoading(false);
        return;
      }

      try {
        const response =
          category === "anime"
            ? await searchAnime(query)
            : category === "korean"
              ? await searchKorean(query)
              : await searchMulti(query);

        if (requestId !== requestIdRef.current) return;

        // For anime/korean categories, strict filtering is already applied in searchAnime/searchKorean
        // For general search, only apply minimal filtering (no people, no junk)
        const baseResults = category
          ? response.results
          : filterMinimal(response.results.filter((item) => item.media_type === "movie" || item.media_type === "tv"));

        // Store base results; we filter in render so updates to the global blacklist take effect immediately.
        setResults(baseResults);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        if (requestId === requestIdRef.current) {
          console.log("[search] done", { query, category, refreshKey, requestId });
          setIsLoading(false);
        }
      }
    };

    fetchResults();
  }, [query, category, refreshKey, getCache]);

  return (
    <>
      <Helmet>
        <title>{query ? `Search: ${query}${category ? ` in ${getCategoryLabel()}` : ""}` : "Search"} - DanieWatch</title>
        <meta name="description" content={`Search results for ${query}${category ? ` in ${getCategoryLabel()}` : ""}`} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-24 pb-8">
          {query ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                {category === "anime" && <Sparkles className="w-6 h-6 text-primary" />}
                {category === "korean" && <Heart className="w-6 h-6 text-primary" />}
              <h1 className="text-2xl md:text-3xl font-bold">{category ? `${getCategoryLabel()} Results for "${query}"` : `Search Results for "${query}"`}</h1>
            </div>
            {category && <p className="text-sm text-primary/80 mb-2">Showing only {getCategoryLabel()} content</p>}
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

