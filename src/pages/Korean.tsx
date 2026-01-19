import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Movie, filterAdultContentStrict } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminListFilter } from "@/contexts/AdminListFilterContext";
import { groupDbLinkedFirst } from "@/lib/sortContent";

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

const Korean = () => {
  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  const { getAvailability, isLoading: isAvailabilityLoading } = useEntryAvailability();

  const [items, setItems] = useState<Movie[]>([]);
  const [displayCount, setDisplayCount] = useState(0);
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

  const baseVisible = useMemo(() => filterBlockedPosts(items), [filterBlockedPosts, items]);

  const visibleItems = useMemo(() => {
    const sorted = isAvailabilityLoading
      ? baseVisible
      : groupDbLinkedFirst(baseVisible, (it) => {
          const a = getAvailability(it.id);
          return a.hasWatch || a.hasDownload;
        });

    return isAdmin && showOnlyDbLinked
      ? sorted.filter((it) => {
          const a = getAvailability(it.id);
          return a.hasWatch || a.hasDownload;
        })
      : sorted;
  }, [baseVisible, getAvailability, isAdmin, isAvailabilityLoading, showOnlyDbLinked]);

  // Preload hover images in the background ONLY (never gate the grid render on this).
  usePageHoverPreload(visibleItems, { enabled: !isLoading });

  // Only show skeletons before we have any real items to render.
  const pageIsLoading = visibleItems.length === 0 && (isLoading || isModerationLoading || isAvailabilityLoading);

  const { saveCache, getCache } = useListStateCache<Movie>();

  // Try to restore from cache on mount
  useEffect(() => {
    const cached = getCache("default", selectedTags);
    if (cached && cached.items.length > 0) {
      restoreScrollYRef.current = cached.scrollY ?? 0;
      setItems(cached.items);
      setDisplayCount(cached.items.length);
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
      } else {
        setIsLoadingMore(true);
      }

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

        // Build movie params - sorted by release date desc
        const movieParams = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "primary_release_date.desc",
          with_original_language: "ko",
          "vote_count.gte": "50",
          "primary_release_date.lte": today,
        });

        // Build TV params - sorted by first air date desc
        const tvParams = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "first_air_date.desc",
          with_original_language: "ko",
          "vote_count.gte": "20",
          "first_air_date.lte": today,
        });

        // Year filter
        if (selectedYear) {
          if (selectedYear === "older") {
            movieParams.set("primary_release_date.lte", "2019-12-31");
            tvParams.set("first_air_date.lte", "2019-12-31");
          } else {
            movieParams.set("primary_release_year", selectedYear);
            tvParams.set("first_air_date_year", selectedYear);
          }
        }

        // Genre filter
        if (selectedTags.length > 0) {
          movieParams.set("with_genres", movieGenres);
          tvParams.set("with_genres", tvGenres);
        }

        // Fetch both movies and TV in parallel
        const [moviesRes, tvRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/discover/movie?${movieParams}`),
          fetch(`https://api.themoviedb.org/3/discover/tv?${tvParams}`),
        ]);

        const [moviesData, tvData] = await Promise.all([moviesRes.json(), tvRes.json()]);

        // Combine with media_type tags and filter adult content with strict certification checks
        const combined = [
          ...(moviesData.results || []).map((m: Movie) => ({ ...m, media_type: "movie" as const })),
          ...(tvData.results || []).map((t: Movie) => ({ ...t, media_type: "tv" as const })),
        ];
        const combinedResults = await filterAdultContentStrict(combined);

        // Sort by release date descending
        const sortedResults = combinedResults.sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || "";
          const dateB = b.release_date || b.first_air_date || "";
          return dateB.localeCompare(dateA);
        });

        // Hide blocked posts for normal users; admins can toggle show/hide
        const visibleResults = filterBlockedPosts(sortedResults);

        if (reset) {
          setItems(visibleResults);
          setDisplayCount(BATCH_SIZE);
        } else {
          setItems((prev) => [...prev, ...visibleResults]);
          if (loadMoreFetchRequestedRef.current) {
            loadMoreFetchRequestedRef.current = false;
            setDisplayCount((prev) => prev + BATCH_SIZE);
          }
        }

        // Has more if either endpoint has more pages
        const maxPages = Math.max(moviesData.total_pages || 0, tvData.total_pages || 0);
        setHasMore(pageNum < maxPages);
      } catch (error) {
        console.error("Failed to fetch Korean content:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedTags, selectedYear, setIsLoadingMore, filterBlockedPosts]
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
    setDisplayCount(0);
    setHasMore(true);
    fetchKorean(1, true);
  }, [selectedTags, selectedYear, isInitialized]);

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
      setDisplayCount((prev) => Math.min(prev + BATCH_SIZE, visibleItems.length));
      setPendingLoadMore(false);
      return;
    }

    if (!hasMore) {
      setPendingLoadMore(false);
      return;
    }

    loadMoreFetchRequestedRef.current = true;
    setIsLoadingMore(true);
    setPendingLoadMore(false);
    setPage((prev) => prev + 1);
  }, [pendingLoadMore, displayCount, visibleItems.length, hasMore, setIsLoadingMore]);

  // Fetch more when page changes
  useEffect(() => {
    if (page > 1 && !isRestoredFromCache) {
      fetchKorean(page);
    }
  }, [page, fetchKorean, isRestoredFromCache]);

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
        

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">Korean</h1>

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
              : visibleItems.slice(0, displayCount).map((item, index) => (
                  <MovieCard
                    key={`${item.id}-${item.media_type ?? "movie"}`}
                    movie={item}
                    animationDelay={Math.min(index * 30, 300)}
                    enableReveal={false}
                    enableHoverPortal={false}
                  />
                ))}
          </div>

          {/* No results message */}
          {!pageIsLoading && visibleItems.length === 0 && (
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

export default Korean;

