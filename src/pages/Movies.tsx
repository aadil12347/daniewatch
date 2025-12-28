import { useEffect, useState, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getPopularMovies, getNowPlayingMovies, getTopRatedMovies, getUpcomingMovies, Movie } from "@/lib/tmdb";
import { Loader2 } from "lucide-react";

const Movies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"popular" | "now_playing" | "top_rated" | "upcoming">("popular");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchMovies = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      let response;
      switch (activeTab) {
        case "now_playing":
          response = await getNowPlayingMovies(pageNum);
          break;
        case "top_rated":
          response = await getTopRatedMovies(pageNum);
          break;
        case "upcoming":
          response = await getUpcomingMovies(pageNum);
          break;
        default:
          response = await getPopularMovies(pageNum);
      }

      if (reset) {
        setMovies(response.results);
      } else {
        setMovies(prev => [...prev, ...response.results]);
      }
      setHasMore(response.page < response.total_pages);
    } catch (error) {
      console.error("Failed to fetch movies:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab]);

  // Reset and fetch when tab changes
  useEffect(() => {
    setPage(1);
    setMovies([]);
    setHasMore(true);
    fetchMovies(1, true);
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
      fetchMovies(page);
    }
  }, [page, fetchMovies]);

  const tabs = [
    { key: "popular", label: "Popular" },
    { key: "now_playing", label: "Now Playing" },
    { key: "top_rated", label: "Top Rated" },
    { key: "upcoming", label: "Upcoming" },
  ] as const;

  return (
    <>
      <Helmet>
        <title>Movies - Cineby</title>
        <meta name="description" content="Browse popular, now playing, top rated, and upcoming movies." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">Movies</h1>

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
              : movies.map((movie, index) => (
                  <MovieCard key={`${movie.id}-${index}`} movie={{ ...movie, media_type: "movie" }} />
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
            {!hasMore && movies.length > 0 && (
              <p className="text-muted-foreground">You've reached the end</p>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Movies;
