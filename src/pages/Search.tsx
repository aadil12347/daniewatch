import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search as SearchIcon, Sparkles, Heart } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/PaginationBar";
import {
  searchMulti,
  searchAnime,
  searchKorean,
  filterMinimal,
  sortByReleaseAirDateDesc,
  Movie,
} from "@/lib/tmdb";

const MIN_RATING = 6; // 3 stars

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const refreshKey = searchParams.get("t") || "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [results, setResults] = useState<Movie[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const getCategoryLabel = () => {
    if (category === "anime") return "Anime";
    if (category === "korean") return "Korean";
    return "";
  };

  // Reset page when query/category changes
  useEffect(() => {
    if (page !== 1) {
      const next = new URLSearchParams(searchParams);
      next.set("page", "1");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    setResults([]);
    setIsLoading(true);

    const fetchResults = async () => {
      if (!query.trim()) {
        if (requestId === requestIdRef.current) setIsLoading(false);
        return;
      }

      try {
        const response =
          category === "anime"
            ? await searchAnime(query, page)
            : category === "korean"
              ? await searchKorean(query, page)
              : await searchMulti(query, page);

        if (requestId !== requestIdRef.current) return;

        const base = category
          ? response.results
          : filterMinimal(
              response.results.filter(
                (item) => item.media_type === "movie" || item.media_type === "tv",
              ),
            );

        const filtered = base.filter((m) => (m.vote_average ?? 0) >= MIN_RATING);

        setResults(sortByReleaseAirDateDesc(filtered));
        setTotalPages(Math.max(1, response.total_pages || 1));
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Search failed:", error);
        setResults([]);
        setTotalPages(1);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    };

    fetchResults();
  }, [query, category, refreshKey, page]);

  return (
    <>
      <Helmet>
        <title>
          {query
            ? `Search: ${query}${category ? ` in ${getCategoryLabel()}` : ""}`
            : "Search"} - DanieWatch
        </title>
        <meta
          name="description"
          content={`Search results for ${query}${category ? ` in ${getCategoryLabel()}` : ""}`}
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 pt-24 pb-8">
          {query ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                {category === "anime" && (
                  <Sparkles className="w-6 h-6 text-primary" />
                )}
                {category === "korean" && <Heart className="w-6 h-6 text-primary" />}
                <h1 className="text-2xl md:text-3xl font-bold">
                  {category
                    ? `${getCategoryLabel()} Results for "${query}"`
                    : `Search Results for "${query}"`}
                </h1>
              </div>
              {category && (
                <p className="text-sm text-primary/80 mb-2">
                  Showing only {getCategoryLabel()} content
                </p>
              )}
              <p className="text-muted-foreground mb-8">
                {isLoading ? "Searching..." : `Page ${page} of ${totalPages}`}
              </p>
            </>
          ) : (
            <div className="text-center py-20">
              <SearchIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Search Movies & TV Shows</h1>
              <p className="text-muted-foreground">
                Use the search bar above to find your favorite content
              </p>
            </div>
          )}

          {(isLoading || results.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
              {isLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <div key={i}>
                      <Skeleton className="aspect-[2/3] rounded-xl" />
                      <Skeleton className="h-4 w-3/4 mt-3" />
                      <Skeleton className="h-3 w-1/2 mt-2" />
                    </div>
                  ))
                : results.map((item) => <MovieCard key={item.id} movie={item} />)}
            </div>
          )}

          {!isLoading && query && results.length === 0 && (
            <div className="text-center py-20">
              <p className="text-xl text-muted-foreground">
                No results found for "{query}"
              </p>
              <p className="text-muted-foreground mt-2">Try searching for something else</p>
            </div>
          )}

          {query && (
            <div className="py-10">
              <PaginationBar
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("page", String(p));
                  setSearchParams(next);
                }}
              />
            </div>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Search;
