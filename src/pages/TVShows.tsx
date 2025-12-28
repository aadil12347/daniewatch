import { useEffect, useState, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getPopularTV, getTopRatedTV, getTVGenres, Movie, Genre } from "@/lib/tmdb";
import { Loader2, X } from "lucide-react";

const TVShows = () => {
  const [shows, setShows] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"popular" | "top_rated" | "latest" | "on_air">("popular");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  const fetchShows = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      let response;
      
      if (activeTab === "latest" || activeTab === "on_air") {
        // Use discover endpoint for latest and on_air
        const params = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          page: pageNum.toString(),
          sort_by: activeTab === "latest" ? "first_air_date.desc" : "popularity.desc",
          ...(activeTab === "latest" && { "first_air_date.lte": new Date().toISOString().split("T")[0] }),
          ...(activeTab === "on_air" && { "air_date.gte": new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
          ...(selectedGenres.length > 0 && { with_genres: selectedGenres.join(",") }),
        });
        const res = await fetch(`https://api.themoviedb.org/3/discover/tv?${params}`);
        response = await res.json();
      } else {
        response = activeTab === "top_rated" 
          ? await getTopRatedTV(pageNum) 
          : await getPopularTV(pageNum);
      }

      // Filter by genre if genres are selected (for non-discover endpoints)
      let filteredResults = response.results;
      if (selectedGenres.length > 0 && activeTab !== "latest" && activeTab !== "on_air") {
        filteredResults = response.results.filter((show: Movie) =>
          selectedGenres.some(genreId => show.genre_ids?.includes(genreId))
        );
      }

      if (reset) {
        setShows(filteredResults);
      } else {
        setShows(prev => [...prev, ...filteredResults]);
      }
      setHasMore(response.page < response.total_pages);
    } catch (error) {
      console.error("Failed to fetch TV shows:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, selectedGenres]);

  // Reset and fetch when tab or genres change
  useEffect(() => {
    setPage(1);
    setShows([]);
    setHasMore(true);
    fetchShows(1, true);
  }, [activeTab, selectedGenres]);

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

  const toggleGenre = (genreId: number) => {
    setSelectedGenres(prev =>
      prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  };

  const clearGenres = () => {
    setSelectedGenres([]);
  };

  const tabs = [
    { key: "popular", label: "Popular" },
    { key: "latest", label: "Latest" },
    { key: "top_rated", label: "Top Rated" },
    { key: "on_air", label: "On Air" },
  ] as const;

  return (
    <>
      <Helmet>
        <title>TV Shows - Cineby</title>
        <meta name="description" content="Browse popular, latest, and top rated TV shows." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">TV Shows</h1>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
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

          {/* Genre Filters */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Filter by genre:</span>
              {selectedGenres.length > 0 && (
                <button
                  onClick={clearGenres}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => toggleGenre(genre.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedGenres.includes(genre.id)
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "bg-secondary/30 hover:bg-secondary/50 text-foreground/70"
                  }`}
                >
                  {genre.name}
                </button>
              ))}
            </div>
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

          {/* No results message */}
          {!isLoading && shows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No TV shows found with the selected filters.</p>
              <button
                onClick={clearGenres}
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
