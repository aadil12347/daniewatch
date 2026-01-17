import { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Movie, filterAdultContentStrict } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { InlineDotsLoader } from "@/components/InlineDotsLoader";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";

type IndianLang = "all" | "ta" | "te" | "hi";

const INDIAN_LANGS: Array<{ key: IndianLang; label: string; tmdbLang?: string }> = [
  { key: "all", label: "All" },
  { key: "ta", label: "Tamil", tmdbLang: "ta" },
  { key: "te", label: "Telugu", tmdbLang: "te" },
  { key: "hi", label: "Bollywood", tmdbLang: "hi" },
];

const Indian = () => {
  const [items, setItems] = useState<Movie[]>([]);
  const [selectedLang, setSelectedLang] = useState<IndianLang>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useMinDurationLoading(2000);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { saveCache, getCache } = useListStateCache<Movie>();

  // Restore from cache on mount
  useEffect(() => {
    const cached = getCache(selectedLang, []);
    if (cached && cached.items.length > 0) {
      setItems(cached.items);
      setPage(cached.page);
      setHasMore(cached.hasMore);
      setIsLoading(false);
      setIsRestoredFromCache(true);
    }
    setIsInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save cache before unmount / route change
  useEffect(() => {
    return () => {
      if (items.length > 0) {
        saveCache({
          items,
          page,
          hasMore,
          activeTab: selectedLang,
          selectedFilters: [],
        });
      }
    };
  }, [items, page, hasMore, selectedLang, saveCache]);

  const fetchIndian = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const today = new Date().toISOString().split("T")[0];

        const langsToFetch =
          selectedLang === "all"
            ? INDIAN_LANGS.filter((l) => l.key !== "all").map((l) => l.tmdbLang!)
            : [INDIAN_LANGS.find((l) => l.key === selectedLang)?.tmdbLang!].filter(Boolean);

        const buildMovieParams = (lang: string) =>
          new URLSearchParams({
            api_key: "fc6d85b3839330e3458701b975195487",
            include_adult: "false",
            page: pageNum.toString(),
            // Latest → old
            sort_by: "primary_release_date.desc",
            with_origin_country: "IN",
            with_original_language: lang,
            // Don’t hide content behind “popular/top rated” thresholds, but also avoid unrated items.
            "vote_count.gte": "1",
            "vote_average.gte": "1",
            "primary_release_date.lte": today,
          });

        const buildTvParams = (lang: string) =>
          new URLSearchParams({
            api_key: "fc6d85b3839330e3458701b975195487",
            include_adult: "false",
            page: pageNum.toString(),
            // Latest → old
            sort_by: "first_air_date.desc",
            with_origin_country: "IN",
            with_original_language: lang,
            "vote_count.gte": "1",
            "vote_average.gte": "1",
            "first_air_date.lte": today,
          });

        // Fetch movies+tv for each language in parallel
        const requests = langsToFetch.flatMap((lang) => [
          fetch(`https://api.themoviedb.org/3/discover/movie?${buildMovieParams(lang)}`),
          fetch(`https://api.themoviedb.org/3/discover/tv?${buildTvParams(lang)}`),
        ]);

        const responses = await Promise.all(requests);
        const jsons = await Promise.all(responses.map((r) => r.json()));

        // Combine results (movie/tv alternates in jsons)
        const combined = jsons.flatMap((data, idx) => {
          const isMovie = idx % 2 === 0;
          const mediaType = isMovie ? ("movie" as const) : ("tv" as const);
          return (data?.results || []).map((m: Movie) => ({ ...m, media_type: mediaType }));
        });

        const combinedResults: Movie[] = await filterAdultContentStrict(combined);

        // Sort by release/air date desc
        const sortedResults = combinedResults.sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || "";
          const dateB = b.release_date || b.first_air_date || "";
          return dateB.localeCompare(dateA);
        });

        if (reset) {
          setItems(sortedResults);
        } else {
          setItems((prev) => {
            const existingKeys = new Set(prev.map((item) => `${item.id}-${item.media_type}`));
            const newItems = sortedResults.filter((item) => !existingKeys.has(`${item.id}-${item.media_type}`));
            return [...prev, ...newItems];
          });
        }

        // Determine pagination
        const totalPages = jsons.map((d) => Number(d?.total_pages || 0));
        const maxPages = Math.max(...totalPages, 0);
        setHasMore(pageNum < maxPages);
      } catch (error) {
        console.error("Failed to fetch Indian content:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedLang, setIsLoadingMore]
  );

  // Reset and fetch when language changes
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
  }, [selectedLang, isInitialized, fetchIndian, isRestoredFromCache]);

  // Tell global loader it can stop as soon as we have real content on screen.
  useEffect(() => {
    if (!isLoading && items.length > 0) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("route:content-ready")));
    }
  }, [isLoading, items.length]);

  // Infinite scroll observer
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          setPage((prev) => prev + 1);
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
      fetchIndian(page, false);
    }
  }, [page, fetchIndian, isRestoredFromCache]);

  return (
    <>
      <Helmet>
        <title>Indian - DanieWatch</title>
        <meta
          name="description"
          content="Tamil, Telugu and Bollywood movies & TV sorted from latest to oldest with infinite scroll."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 content-reveal">Indian</h1>

          {/* Language chips */}
          <div className="mb-8 flex flex-wrap gap-2">
            {INDIAN_LANGS.map((l) => (
              <button
                key={l.key}
                type="button"
                onMouseMove={(e) => {
                  const el = e.currentTarget;
                  const rect = el.getBoundingClientRect();
                  el.style.setProperty("--hs-x", `${e.clientX - rect.left}px`);
                  el.style.setProperty("--hs-y", `${e.clientY - rect.top}px`);
                }}
                onClick={() => setSelectedLang(l.key)}
                className={cn(
                  "hover-swipe rounded-full border px-4 py-2 text-sm transition-colors",
                  l.key === selectedLang
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/30 text-foreground border-border hover:text-primary-foreground"
                )}
              >
                <span>{l.label}</span>
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
              : items.map((item, index) => (
                  <MovieCard
                    key={`${item.id}-${item.media_type}`}
                    movie={item}
                    animationDelay={Math.min(index * 30, 300)}
                  />
                ))}
          </div>

          {/* No results */}
          {!isLoading && items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No results found.</p>
            </div>
          )}

          {/* Load more sentinel (stop quietly at end) */}
          <div ref={loadMoreRef} className="flex justify-center py-6">
            {isLoadingMore && <InlineDotsLoader ariaLabel="Loading more" />}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Indian;

