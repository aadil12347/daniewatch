import { useEffect, useState, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { getTVGenres, filterAdultContent, Movie, Genre } from "@/lib/tmdb";
import { Loader2 } from "lucide-react";
import { useListStateCache } from "@/hooks/useListStateCache";

const TVShows = () => {
  const [shows, setShows] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0); // dayOffset cursor (0=today)
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { saveCache, getCache } = useListStateCache<Movie>();

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

  // Try to restore from cache on mount
  useEffect(() => {
    const cached = getCache("default", selectedGenres);
    if (cached && cached.items.length > 0) {
      setShows(cached.items);
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
      if (shows.length > 0) {
        saveCache({
          items: shows,
          page,
          hasMore,
          activeTab: "default",
          selectedFilters: selectedGenres,
        });
      }
    };
  }, [shows, page, hasMore, selectedGenres, saveCache]);

  const fetchShows = useCallback(async (dayOffset: number, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const MIN_ITEMS = 18;
      const MAX_DAYS_SCAN = 7;

      const today = new Date();

      const isDateAllowed = (dateISO: string) => {
        if (!selectedYear) return true;
        if (selectedYear === "older") return dateISO <= "2019-12-31";
        return dateISO.startsWith(`${selectedYear}-`);
      };

      const toISODate = (d: Date) => d.toISOString().split("T")[0];

      let offset = dayOffset;
      let daysScanned = 0;
      const collected: Movie[] = [];

      while (collected.length < MIN_ITEMS && daysScanned < MAX_DAYS_SCAN) {
        const target = new Date(today);
        target.setDate(today.getDate() - offset);
        const dateISO = toISODate(target);

        offset += 1;
        daysScanned += 1;

        if (!isDateAllowed(dateISO)) continue;

        const params = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: "1",
          sort_by: "popularity.desc",
          "vote_count.gte": "20",
          "first_air_date.gte": dateISO,
          "first_air_date.lte": dateISO,
        });

        if (selectedGenres.length > 0) {
          params.set("with_genres", selectedGenres.join(","));
        }

        const res = await fetch(`https://api.themoviedb.org/3/discover/tv?${params}`);
        const response = await res.json();

        const dayResults = filterAdultContent(response.results || []) as Movie[];
        if (dayResults.length > 0) {
          collected.push(...dayResults);
        }
      }

      if (reset) {
        setShows(collected);
      } else {
        setShows((prev) => [...prev, ...collected]);
      }

      setPage(offset);
      setHasMore(true);
    } catch (error) {
      console.error("Failed to fetch TV shows:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [selectedGenres, selectedYear]);

  // Reset and fetch when filters change
  useEffect(() => {
    if (!isInitialized) return;
    if (isRestoredFromCache) {
      setIsRestoredFromCache(false);
      return;
    }
    setPage(0);
    setShows([]);
    setHasMore(true);
    fetchShows(0, true);
  }, [selectedGenres, selectedYear, isInitialized]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchShows(page, false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading, isLoadingMore, page, fetchShows]);


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

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedYear(null);
  };

  // Convert genres to CategoryNav format
  const genresForNav = genres.map(g => ({ id: g.id, name: g.name }));

  return (
    <>
      <Helmet>
        <title>TV Shows - DanieWatch</title>
        <meta name="description" content="Browse TV shows sorted by latest release date. Filter by genre and year." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">TV Shows</h1>

          {/* Category Navigation */}
          <div className="mb-8">
            <CategoryNav
              genres={genresForNav}
              selectedGenres={selectedGenres}
              onGenreToggle={toggleGenre}
              onClearGenres={clearGenres}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
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
              : shows.map((show, index) => (
                  <MovieCard 
                    key={`${show.id}-${index}`} 
                    movie={{ ...show, media_type: "tv" }} 
                    animationDelay={Math.min(index * 30, 300)}
                  />
                ))}
          </div>

          {/* No results message */}
          {!isLoading && shows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No TV shows found with the selected filters.</p>
              <button
                onClick={clearFilters}
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
