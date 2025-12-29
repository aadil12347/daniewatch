import { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, X } from "lucide-react";

// Korean drama sub-genres/tags
const KOREAN_TAGS = [
  { id: "romance", label: "Romance", genreId: 10749 },
  { id: "drama", label: "Drama", genreId: 18 },
  { id: "comedy", label: "Comedy", genreId: 35 },
  { id: "action", label: "Action", genreId: 10759 },
  { id: "mystery", label: "Mystery", genreId: 9648 },
  { id: "fantasy", label: "Fantasy", genreId: 10765 },
  { id: "crime", label: "Crime", genreId: 80 },
  { id: "family", label: "Family", genreId: 10751 },
];

const Korean = () => {
  const [items, setItems] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"popular" | "top_rated" | "latest" | "airing">("popular");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  const fetchKorean = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // Build custom params for Korean dramas
      const params = new URLSearchParams({
        api_key: "fc6d85b3839330e3458701b975195487",
        page: pageNum.toString(),
        sort_by: getSortBy(activeTab),
        with_original_language: "ko", // Korean language
        ...(selectedTags.length > 0 && { with_genres: selectedTags.join(",") }),
        ...(activeTab === "latest" && { "first_air_date.lte": new Date().toISOString().split("T")[0] }),
        ...(activeTab === "airing" && { "air_date.gte": new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
        ...(activeTab === "top_rated" && { "vote_count.gte": "100" }),
      });

      const res = await fetch(`https://api.themoviedb.org/3/discover/tv?${params}`);
      const response = await res.json();

      if (reset) {
        setItems(response.results);
      } else {
        setItems(prev => [...prev, ...response.results]);
      }
      setHasMore(response.page < response.total_pages);
    } catch (error) {
      console.error("Failed to fetch Korean dramas:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, selectedTags]);

  // Reset and fetch when tab or tags change
  useEffect(() => {
    setPage(1);
    setItems([]);
    setHasMore(true);
    fetchKorean(1, true);
  }, [activeTab, selectedTags]);

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
      fetchKorean(page);
    }
  }, [page, fetchKorean]);

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

  const tabs = [
    { key: "popular", label: "Popular" },
    { key: "latest", label: "Latest" },
    { key: "top_rated", label: "Top Rated" },
    { key: "airing", label: "Airing Now" },
  ] as const;

  return (
    <>
      <Helmet>
        <title>Korean Dramas - DanieWatch</title>
        <meta name="description" content="Watch the best Korean dramas - popular K-dramas, latest releases, and top rated series" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">Korean Dramas</h1>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-6 content-reveal content-reveal-delay-1">
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

          {/* Genre/Tag Filters */}
          <div className="mb-8 content-reveal content-reveal-delay-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Filter by genre:</span>
              {selectedTags.length > 0 && (
                <button
                  onClick={clearTags}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {KOREAN_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.genreId)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedTags.includes(tag.genreId)
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "bg-secondary/30 hover:bg-secondary/50 text-foreground/70"
                  }`}
                >
                  {tag.label}
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
              <p className="text-muted-foreground">No Korean dramas found with the selected filters.</p>
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

export default Korean;