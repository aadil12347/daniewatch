import { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { Movie, filterAdultContentStrict } from "@/lib/tmdb";
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
  const scrollPositionRef = useRef<number>(0);
  
  // Use refs to track current values for fetch without causing re-renders
  const activeTabRef = useRef(activeTab);
  const selectedTagsRef = useRef(selectedTags);
  
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  
  useEffect(() => {
    selectedTagsRef.current = selectedTags;
  }, [selectedTags]);

  const { saveCache, getCache } = useListStateCache<Movie>();

  // Save scroll position on scroll
  useEffect(() => {
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Try to restore from cache on mount
  useEffect(() => {
    const cached = getCache(activeTab, selectedTags);
    if (cached && cached.items.length > 0) {
      setItems(cached.items);
      setPage(cached.page);
      setHasMore(cached.hasMore);
      setIsLoading(false);
      setIsRestoredFromCache(true);
      // Restore scroll position after items render
      requestAnimationFrame(() => {
        const savedScroll = sessionStorage.getItem("indian_scroll");
        if (savedScroll) {
          window.scrollTo(0, parseInt(savedScroll, 10));
        }
      });
    }
    setIsInitialized(true);
  }, []);

  // Save cache and scroll position before unmount
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
        sessionStorage.setItem("indian_scroll", scrollPositionRef.current.toString());
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
        return "first_air_date.desc";
      default:
        return "popularity.desc";
    }
  };

  // Stable fetch function that reads from refs
  const fetchIndian = useCallback(async (pageNum: number, reset: boolean = false) => {
    const currentTab = activeTabRef.current;
    const currentTags = selectedTagsRef.current;
    
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      
      // Build genre params - handle action genre difference for TV
      const movieGenres = currentTags.join(",");
      const tvGenres = currentTags.map(g => g === 28 ? TV_ACTION_GENRE : g).join(",");

      // Build movie params
      const movieParams = new URLSearchParams({
        api_key: "fc6d85b3839330e3458701b975195487",
        include_adult: "false",
        page: pageNum.toString(),
        sort_by: getSortBy(currentTab),
        with_origin_country: "IN",
        "primary_release_date.lte": today,
      });
      
      if (currentTags.length > 0) {
        movieParams.set("with_genres", movieGenres);
      }
      if (currentTab === "top_rated") {
        movieParams.set("vote_count.gte", "100");
      }
      if (currentTab === "popular") {
        movieParams.set("vote_count.gte", "50");
      }

      // Build TV params
      const tvParams = new URLSearchParams({
        api_key: "fc6d85b3839330e3458701b975195487",
        include_adult: "false",
        page: pageNum.toString(),
        sort_by: getTvSortBy(currentTab),
        with_origin_country: "IN",
        "first_air_date.lte": today,
      });
      
      if (currentTags.length > 0) {
        tvParams.set("with_genres", tvGenres);
      }
      if (currentTab === "top_rated") {
        tvParams.set("vote_count.gte", "50");
      }
      if (currentTab === "popular") {
        tvParams.set("vote_count.gte", "20");
      }

      // Fetch both movies and TV in parallel
      const [moviesRes, tvRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/discover/movie?${movieParams}`),
        fetch(`https://api.themoviedb.org/3/discover/tv?${tvParams}`)
      ]);

      const [moviesData, tvData] = await Promise.all([
        moviesRes.json(),
        tvRes.json()
      ]);

      // Combine with media_type tags and filter adult content with strict certification checks
      const combined = [
        ...(moviesData.results || []).map((m: Movie) => ({ ...m, media_type: "movie" as const })),
        ...(tvData.results || []).map((t: Movie) => ({ ...t, media_type: "tv" as const }))
      ];
      const combinedResults: Movie[] = await filterAdultContentStrict(combined);

      // Sort by date for popular/latest, by popularity otherwise
      const sortedResults = combinedResults.sort((a, b) => {
        if (currentTab === "latest" || currentTab === "popular") {
          const dateA = a.release_date || a.first_air_date || "";
          const dateB = b.release_date || b.first_air_date || "";
          return dateB.localeCompare(dateA);
        }
        return ((b as Movie & { popularity?: number }).popularity || 0) - ((a as Movie & { popularity?: number }).popularity || 0);
      });

      if (reset) {
        setItems(sortedResults);
      } else {
        setItems(prev => {
          // Deduplicate by id + media_type
          const existingKeys = new Set(prev.map(item => `${item.id}-${item.media_type}`));
          const newItems = sortedResults.filter(item => !existingKeys.has(`${item.id}-${item.media_type}`));
          // Simply append new items - don't re-sort to avoid jumping
          return [...prev, ...newItems];
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
  }, []);

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
  }, [activeTab, selectedTags, isInitialized, fetchIndian]);

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

  // Fetch more when page changes (not on initial load or cache restore)
  useEffect(() => {
    if (page > 1 && !isRestoredFromCache) {
      fetchIndian(page, false);
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
                    key={`${item.id}-${item.media_type}`} 
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
