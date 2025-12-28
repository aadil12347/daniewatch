import { useEffect, useState, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getPopularTV, getTopRatedTV, Movie } from "@/lib/tmdb";
import { Loader2 } from "lucide-react";

const TVShows = () => {
  const [shows, setShows] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"popular" | "top_rated">("popular");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchShows = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = activeTab === "top_rated" 
        ? await getTopRatedTV(pageNum) 
        : await getPopularTV(pageNum);

      if (reset) {
        setShows(response.results);
      } else {
        setShows(prev => [...prev, ...response.results]);
      }
      setHasMore(response.page < response.total_pages);
    } catch (error) {
      console.error("Failed to fetch TV shows:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab]);

  // Reset and fetch when tab changes
  useEffect(() => {
    setPage(1);
    setShows([]);
    setHasMore(true);
    fetchShows(1, true);
  }, [activeTab]);

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
    if (page > 1) {
      fetchShows(page);
    }
  }, [page, fetchShows]);

  const tabs = [
    { key: "popular", label: "Popular" },
    { key: "top_rated", label: "Top Rated" },
  ] as const;

  return (
    <>
      <Helmet>
        <title>TV Shows - Cineby</title>
        <meta name="description" content="Browse popular and top rated TV shows." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">TV Shows</h1>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "gradient-red text-foreground"
                    : "bg-secondary/50 hover:bg-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
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
              : shows.map((show, index) => (
                  <MovieCard key={`${show.id}-${index}`} movie={{ ...show, media_type: "tv" }} />
                ))}
          </div>

          {/* Loading More Indicator */}
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading more...</span>
              </div>
            )}
            {!hasMore && shows.length > 0 && (
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
