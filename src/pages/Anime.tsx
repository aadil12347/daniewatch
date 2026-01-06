import { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Movie, filterAdultContent } from "@/lib/tmdb";
import { Loader2 } from "lucide-react";
import { useListStateCache } from "@/hooks/useListStateCache";

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

const Anime = () => {
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
        return "first_air_date.desc";
      case "airing":
        return "popularity.desc";
      default:
        return "popularity.desc";
    }
  };

  const fetchAnime = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const allGenres = [ANIME_GENRE_ID, ...selectedTags];
      
      // Build custom params for more control
      const params = new URLSearchParams({
        api_key: "fc6d85b3839330e3458701b975195487",
        page: pageNum.toString(),
        sort_by: getSortBy(activeTab),
        with_genres: allGenres.join(","),
        with_original_language: "ja",
        ...(activeTab === "latest" && { "first_air_date.lte": new Date().toISOString().split("T")[0] }),
        ...(activeTab === "airing" && { "air_date.gte": new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
        ...(activeTab === "top_rated" && { "vote_count.gte": "100" }),
      });

      const res = await fetch(`https://api.themoviedb.org/3/discover/tv?${params}`);
      const response = await res.json();

      const filteredResults = filterAdultContent(response.results) as Movie[];
      if (reset) {
        setItems(filteredResults);
      } else {
        setItems(prev => [...prev, ...filteredResults]);
      }
      setHasMore(response.page < response.total_pages);
    } catch (error) {
      console.error("Failed to fetch anime:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, selectedTags]);

  // Reset and fetch when tab or tags change (skip if just initialized from cache)
  useEffect(() => {
    if (!isInitialized) return;
    if (isRestoredFromCache) {
      setIsRestoredFromCache(false);
      return;
    }
    setPage(1);
    setItems([]);
    setHasMore(true);
    fetchAnime(1, true);
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
      fetchAnime(page);
    }
  }, [page, fetchAnime, isRestoredFromCache]);

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
  const genresForNav = ANIME_TAGS.map(tag => ({ id: tag.genreId, name: tag.label }));

  return (
    <>
      <Helmet>
        <title>Anime - DanieWatch</title>
        <meta name="description" content="Watch the best anime series - popular, latest, and top rated" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">Anime</h1>

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
                    key={`${item.id}-${index}`} 
                    movie={{ ...item, media_type: "tv" }} 
                    animationDelay={Math.min(index * 30, 300)}
                  />
                ))}
          </div>

          {/* No results message */}
          {!isLoading && items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No anime found with the selected filters.</p>
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

export default Anime;
