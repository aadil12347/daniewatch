import { useEffect, useState, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { getPopularMovies, getNowPlayingMovies, getTopRatedMovies, getUpcomingMovies, getMovieGenres, Movie, Genre } from "@/lib/tmdb";
import { Loader2 } from "lucide-react";

const Movies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"popular" | "now_playing" | "top_rated" | "upcoming" | "latest">("popular");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch genres on mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await getMovieGenres();
        setGenres(response.genres);
      } catch (error) {
        console.error("Failed to fetch genres:", error);
      }
    };
    fetchGenres();
  }, []);

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
        case "latest":
          // Use discover endpoint for latest movies
          const params = new URLSearchParams({
            api_key: "fc6d85b3839330e3458701b975195487",
            page: pageNum.toString(),
            sort_by: "release_date.desc",
            "release_date.lte": new Date().toISOString().split("T")[0],
            ...(selectedGenres.length > 0 && { with_genres: selectedGenres.join(",") }),
          });
          const res = await fetch(`https://api.themoviedb.org/3/discover/movie?${params}`);
          response = await res.json();
          break;
        default:
          response = await getPopularMovies(pageNum);
      }

      // Filter by genre if genres are selected (for non-discover endpoints)
      let filteredResults = response.results;
      if (selectedGenres.length > 0 && activeTab !== "latest") {
        filteredResults = response.results.filter((movie: Movie) =>
          selectedGenres.some(genreId => movie.genre_ids?.includes(genreId))
        );
      }

      if (reset) {
        setMovies(filteredResults);
      } else {
        setMovies(prev => [...prev, ...filteredResults]);
      }
      setHasMore(response.page < response.total_pages);
    } catch (error) {
      console.error("Failed to fetch movies:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, selectedGenres]);

  // Reset and fetch when tab or genres change
  useEffect(() => {
    setPage(1);
    setMovies([]);
    setHasMore(true);
    fetchMovies(1, true);
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
      fetchMovies(page);
    }
  }, [page, fetchMovies]);

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

  // Convert genres to CategoryNav format
  const genresForNav = genres.map(g => ({ id: g.id, name: g.name }));

  return (
    <>
      <Helmet>
        <title>Movies - Cineby</title>
        <meta name="description" content="Browse popular, latest, now playing, top rated, and upcoming movies." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">Movies</h1>

          {/* Category Navigation */}
          <div className="mb-8">
            <CategoryNav
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
              genres={genresForNav}
              selectedGenres={selectedGenres}
              onGenreToggle={toggleGenre}
              onClearGenres={clearGenres}
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
              : movies.map((movie, index) => (
                  <MovieCard 
                    key={`${movie.id}-${index}`} 
                    movie={{ ...movie, media_type: "movie" }} 
                    animationDelay={Math.min(index * 30, 300)}
                  />
                ))}
          </div>

          {/* No results message */}
          {!isLoading && movies.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No movies found with the selected filters.</p>
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
