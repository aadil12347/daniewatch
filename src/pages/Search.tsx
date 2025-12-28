import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search as SearchIcon } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { searchMulti, Movie } from "@/lib/tmdb";

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await searchMulti(query);
        // Filter to only movies and TV shows
        setResults(
          response.results.filter(
            (item) => item.media_type === "movie" || item.media_type === "tv"
          )
        );
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  return (
    <>
      <Helmet>
        <title>{query ? `Search: ${query}` : "Search"} - Cineby</title>
        <meta name="description" content={`Search results for ${query}`} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          {query ? (
            <>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                Search Results for "{query}"
              </h1>
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
