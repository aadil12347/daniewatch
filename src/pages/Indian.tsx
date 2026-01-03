import { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { Movie } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";

// Indian content genres
const INDIAN_TAGS = [
  { id: "drama", label: "Drama", genreId: 18 },
  { id: "romance", label: "Romance", genreId: 10749 },
  { id: "action", label: "Action", genreId: 28 },
  { id: "comedy", label: "Comedy", genreId: 35 },
  { id: "thriller", label: "Thriller", genreId: 53 },
  { id: "crime", label: "Crime", genreId: 80 },
  { id: "family", label: "Family", genreId: 10751 },
  { id: "musical", label: "Musical", genreId: 10402 },
];

// Action genre ID for TV is different
const TV_ACTION_GENRE = 10759;

const Indian = () => {
  const [items, setItems] = useState<Movie[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"popular" | "top_rated" | "latest" | "airing">("popular");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { saveCache, getCache } = useListStateCache<Movie>();

  // Try to restore from cache on mount
  useEffect(() => {
    const cached = getCache(activeTab, selectedTags);
    if (cached && cached.items.length > 0) {
      setItems(cached.items);
      setPage(cached.page);
      setHasMore(cached.hasMore);
      setIsLoading(false);
      setIsRestoredFromCache(true);
    }
    setIsInitialized(true);
  }, []);

  // Save cache before unmount
  useEffect(() => {
    return () => {
      if (items.length > 0) {
        saveCache({
          items,
          page,
          hasMore,
          activeTab,
          selectedFilters: selectedTags,
        });
      }
    };
  }, [items, page, hasMore, activeTab, selectedTags, saveCache]);

  const getSortBy = (tab: string) => {
    switch (tab) {
      case "top_rated":
        return "vote_average.desc";
      case "latest":
        return "primary_release_date.desc";
      case "popular":
        // Sort by release date but filter for popular content
        return "primary_release_date.desc";
      default:
        return "popularity.desc";
    }
  };

  const getTvSortBy = (tab: string) => {
    switch (tab) {
      case "top_rated":
        return "vote_average.desc";
      case "latest":
        return "first_air_date.desc";
      case "popular":
        // Sort by release date but filter for popular content
        return "first_air_date.desc";
      default:
        return "popularity.desc";
    }
  };

  const fetchIndian = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      
      // Build genre params - handle action genre difference for TV
      const movieGenres = selectedTags.join(",");
      const tvGenres = selectedTags.map(g => g === 28 ? TV_ACTION_GENRE : g).join(",");

      // Build movie params
      const movieParams = new URLSearchParams({
        api_key: "fc6d85b3839330e3458701b975195487",
        page: pageNum.toString(),
        sort_by: getSortBy(activeTab),
        with_origin_country: "IN",
        "primary_release_date.lte": today,
        ...(selectedTags.length > 0 && { with_genres: movieGenres }),
        ...(activeTab === "top_rated" && { "vote_count.gte": "100" }),
        // For popular tab, filter for content with decent popularity
        ...(activeTab === "popular" && { "vote_count.gte": "50" }),
      });

      // Build TV params
      const tvParams = new URLSearchParams({
        api_key: "fc6d85b3839330e3458701b975195487",
        page: pageNum.toString(),
        sort_by: getTvSortBy(activeTab),
        with_origin_country: "IN",
        "first_air_date.lte": today,
        ...(selectedTags.length > 0 && { with_genres: tvGenres }),
        ...(activeTab === "top_rated" && { "vote_count.gte": "50" }),
        // For popular tab, filter for content with decent popularity
        ...(activeTab === "popular" && { "vote_count.gte": "20" }),
      });

      // Fetch both movies and TV in parallel
      const [moviesRes, tvRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/discover/movie?${movieParams}`),
        fetch(`https://api.themoviedb.org/3/discover/tv?${tvParams}`)
      ]);

      const [moviesData, tvData] = await Promise.all([
        moviesRes.json(),
        tvRes.json()
      ]);

      // Combine with media_type tags
      const combinedResults = [
        ...(moviesData.results || []).map((m: Movie) => ({ ...m, media_type: "movie" as const })),
        ...(tvData.results || []).map((t: Movie) => ({ ...t, media_type: "tv" as const }))
      ];

      // Sort based on active tab - both popular and latest sort by release date
      const sortedResults = combinedResults.sort((a, b) => {
        if (activeTab === "latest" || activeTab === "popular") {
          const dateA = a.release_date || a.first_air_date || "";
          const dateB = b.release_date || b.first_air_date || "";
          return dateB.localeCompare(dateA);
        }
        return (b.popularity || 0) - (a.popularity || 0);
      });

      const sortByDateDesc = (a: Movie, b: Movie) => {
        const dateA = a.release_date || a.first_air_date || "";
        const dateB = b.release_date || b.first_air_date || "";
        return dateB.localeCompare(dateA);
      };

      // Deduplicate by unique key (id + media_type)
      const deduplicateItems = (items: Movie[]) => {
        const seen = new Set<string>();
        return items.filter(item => {
          const key = `${item.id}-${item.media_type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      if (reset) {
        setItems(deduplicateItems(sortedResults));
      } else {
        setItems(prev => {
          const merged = [...prev, ...sortedResults];
          const unique = deduplicateItems(merged);
          // Keep global order consistent across pagination for popular/latest
          if (activeTab === "latest" || activeTab === "popular") {
            return unique.sort(sortByDateDesc);
          }
          return unique;
        });
      }

      // Has more if either endpoint has more pages
      const maxPages = Math.max(moviesData.total_pages || 0, tvData.total_pages || 0);
      setHasMore(pageNum < maxPages);
    } catch (error) {
      console.error("Failed to fetch Indian content:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, selectedTags]);

  // Reset and fetch when tab or tags change
  useEffect(() => {
    if (!isInitialized) return;
    if (isRestoredFromCache) {
      setIsRestoredFromCache(false);
      return;
    }
    setPage(1);
    setItems([]);
    setHasMore(true);
    fetchIndian(1, true);
  }, [activeTab, selectedTags, isInitialized]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading, isLoadingMore]);

  // Fetch more when page changes
  useEffect(() => {
    if (page > 1 && !isRestoredFromCache) {
      fetchIndian(page);
    }
  }, [page, fetchIndian, isRestoredFromCache]);

  const toggleTag = (genreId: number) => {
    setSelectedTags(prev =>
      prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

  // Convert tags to genre format for CategoryNav
  const genresForNav = INDIAN_TAGS.map(tag => ({ id: tag.genreId, name: tag.label }));

  return (
    <>
      <Helmet>
        <title>Indian Movies & TV - DanieWatch</title>
        <meta name="description" content="Watch the best Indian movies and TV series - Bollywood, regional cinema, popular shows, and latest releases" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">Indian</h1>

          {/* Category Navigation */}
          <div className="mb-8">
            <CategoryNav
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
              genres={genresForNav}
              selectedGenres={selectedTags}
              onGenreToggle={toggleTag}
              onClearGenres={clearTags}
            />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {isLoading
              ? Array.from({ length: 18 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="aspect-[2/3] rounded-xl" />
                    <Skeleton className="h-4 w-3/4 mt-3" />
                    <Skeleton className="h-3 w-1/2 mt-2" />
                  </div>
                ))
              : items.map((item, index) => (
                  <MovieCard 
                    key={`${item.id}-${item.media_type}-${index}`} 
                    movie={item} 
                    animationDelay={Math.min(index * 30, 300)}
                  />
                ))}
          </div>

          {/* No results message */}
          {!isLoading && items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No Indian content found with the selected filters.</p>
              <button
                onClick={clearTags}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Loading More Indicator */}
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading more...</span>
              </div>
            )}
            {!hasMore && items.length > 0 && (
              <p className="text-muted-foreground">You've reached the end</p>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Indian;
