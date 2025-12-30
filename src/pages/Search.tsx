import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search as SearchIcon, Sparkles, Heart } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { searchMulti, searchAnime, searchKorean, Movie } from "@/lib/tmdb";

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const [results, setResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const getCategoryLabel = () => {
    if (category === "anime") return "Anime";
    if (category === "korean") return "Korean";
    return "";
  };

  useEffect(() => {
    // Increment request id so late responses from older searches can't overwrite new results
    const requestId = ++requestIdRef.current;

    // Always clear results and show loading state for a fresh search
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
            ? await searchAnime(query)
            : category === "korean"
              ? await searchKorean(query)
              : await searchMulti(query);

        if (requestId !== requestIdRef.current) return;

        setResults(
          category
            ? response.results
            : response.results.filter(
                (item) => item.media_type === "movie" || item.media_type === "tv",
              ),
        );
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    };

    fetchResults();
  }, [query, category]);

  return (
    <>
      <Helmet>
        <title>{query ? `Search: ${query}${category ? ` in ${getCategoryLabel()}` : ""}` : "Search"} - DanieWatch</title>
        <meta name="description" content={`Search results for ${query}${category ? ` in ${getCategoryLabel()}` : ""}`} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          {query ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                {category === "anime" && <Sparkles className="w-6 h-6 text-primary" />}
                {category === "korean" && <Heart className="w-6 h-6 text-primary" />}
                <h1 className="text-2xl md:text-3xl font-bold">
                  {category ? `${getCategoryLabel()} Results for "${query}"` : `Search Results for "${query}"`}
                </h1>
              </div>
              {category && (
                <p className="text-sm text-primary/80 mb-2">
                  Showing only {getCategoryLabel()} content
                </p>
              )}
              <p className="text-muted-foreground mb-8">
                {isLoading ? "Searching..." : `Found ${results.length} results`}
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

          {/* Results Grid */}
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

          {/* No Results */}
          {!isLoading && query && results.length === 0 && (
            <div className="text-center py-20">
              <p className="text-xl text-muted-foreground">
                No results found for "{query}"
              </p>
              <p className="text-muted-foreground mt-2">
                Try searching for something else
              </p>
            </div>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Search;
