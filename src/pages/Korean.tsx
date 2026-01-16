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

const Korean = () => {
  const [items, setItems] = useState<Movie[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
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

  // Try to restore from cache on mount
  useEffect(() => {
    const cached = getCache("default", selectedTags);
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
          activeTab: "default",
          selectedFilters: selectedTags,
        });
      }
    };
  }, [items, page, hasMore, selectedTags, saveCache]);

  const fetchKorean = useCallback(async (dayOffset: number, reset: boolean = false) => {
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

      // Build genre params - handle action/fantasy genre difference for TV
      const movieGenres = selectedTags.join(",");
      const tvGenres = selectedTags
        .map((g) => {
          if (g === 28) return TV_ACTION_GENRE;
          if (g === 14) return TV_FANTASY_GENRE;
          return g;
        })
        .join(",");

      while (collected.length < MIN_ITEMS && daysScanned < MAX_DAYS_SCAN) {
        const target = new Date(today);
        target.setDate(today.getDate() - offset);
        const dateISO = toISODate(target);

        offset += 1;
        daysScanned += 1;

        if (!isDateAllowed(dateISO)) continue;

        const movieParams = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: "1",
          sort_by: "popularity.desc",
          with_original_language: "ko",
          "vote_count.gte": "50",
          "primary_release_date.gte": dateISO,
          "primary_release_date.lte": dateISO,
        });

        const tvParams = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: "1",
          sort_by: "popularity.desc",
          with_original_language: "ko",
          "vote_count.gte": "20",
          "first_air_date.gte": dateISO,
          "first_air_date.lte": dateISO,
        });

        if (selectedTags.length > 0) {
          movieParams.set("with_genres", movieGenres);
          tvParams.set("with_genres", tvGenres);
        }

        const [moviesRes, tvRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/discover/movie?${movieParams}`),
          fetch(`https://api.themoviedb.org/3/discover/tv?${tvParams}`),
        ]);

        const [moviesData, tvData] = await Promise.all([moviesRes.json(), tvRes.json()]);

        const combined = [
          ...(moviesData.results || []).map((m: Movie) => ({ ...m, media_type: "movie" as const })),
          ...(tvData.results || []).map((t: Movie) => ({ ...t, media_type: "tv" as const })),
        ];
        const combinedResults = await filterAdultContentStrict(combined);

        combinedResults.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

        if (combinedResults.length > 0) {
          collected.push(...combinedResults);
        }
      }

      if (reset) {
        setItems(collected);
      } else {
        setItems((prev) => [...prev, ...collected]);
      }

      setPage(offset);
      setHasMore(true);
    } catch (error) {
      console.error("Failed to fetch Korean content:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [selectedTags, selectedYear]);

  // Reset and fetch when filters change
  useEffect(() => {
    if (!isInitialized) return;
    if (isRestoredFromCache) {
      setIsRestoredFromCache(false);
      return;
    }
    setPage(0);
    setItems([]);
    setHasMore(true);
    fetchKorean(0, true);
  }, [selectedTags, selectedYear, isInitialized]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchKorean(page, false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading, isLoadingMore, page, fetchKorean]);


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

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedYear(null);
  };

  // Convert tags to genre format for CategoryNav
  const genresForNav = KOREAN_TAGS.map(tag => ({ id: tag.genreId, name: tag.label }));

  return (
    <>
      <Helmet>
        <title>Korean Movies & TV - DanieWatch</title>
        <meta name="description" content="Watch the best Korean movies and TV series sorted by latest release. Filter by genre and year." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

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

export default Korean;
