import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search as SearchIcon, Sparkles, Heart } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { StandardRails } from "@/components/browse/StandardRails";
import { YearSection } from "@/components/browse/YearSection";
import { searchMulti, searchAnime, searchKorean, filterMinimal, Movie } from "@/lib/tmdb";

const getItemYear = (item: Movie): number | null => {
  const date = item.release_date || item.first_air_date;
  if (!date) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
};

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const refreshKey = searchParams.get("t") || "";
  const [results, setResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const getCategoryLabel = () => {
    if (category === "anime") return "Anime";
    if (category === "korean") return "Korean";
    return "";
  };

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
            ? await searchAnime(query)
            : category === "korean"
              ? await searchKorean(query)
              : await searchMulti(query);

        if (requestId !== requestIdRef.current) return;

        const filteredResults = category
          ? response.results
          : filterMinimal(response.results.filter((item) => item.media_type === "movie" || item.media_type === "tv"));

        setResults(filteredResults);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    };

    fetchResults();
  }, [query, category, refreshKey]);

  const grouped = useMemo(() => {
    const map = new Map<number, Movie[]>();
    results.forEach((item) => {
      const y = getItemYear(item);
      if (!y) return;
      const arr = map.get(y) ?? [];
      arr.push(item);
      map.set(y, arr);
    });

    const years = Array.from(map.keys()).sort((a, b) => b - a);
    return { years, byYear: map };
  }, [results]);

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
              {category && <p className="text-sm text-primary/80 mb-2">Showing only {getCategoryLabel()} content</p>}
              <p className="text-muted-foreground mb-8">{isLoading ? "Searching..." : `Found ${results.length} results`}</p>

              {/* Top rails */}
              <StandardRails mode={category === "anime" ? "anime" : category === "korean" ? "korean" : "global"} />

              {/* Grouped results */}
              {grouped.years.map((y) => (
                <YearSection
                  key={y}
                  yearLabel={String(y)}
                  items={grouped.byYear.get(y) ?? []}
                  isLoading={false}
                  mediaType="mixed"
                />
              ))}

              {/* Bottom rails */}
              <StandardRails
                mode={category === "anime" ? "anime" : category === "korean" ? "korean" : "global"}
                titlePrefix="More"
              />
            </>
          ) : (
            <div className="text-center py-20">
              <SearchIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Search Movies & TV Shows</h1>
              <p className="text-muted-foreground">Use the search bar above to find your favorite content</p>
            </div>
          )}

          {!isLoading && query && results.length === 0 && (
            <div className="text-center py-20">
              <p className="text-xl text-muted-foreground">No results found for "{query}"</p>
              <p className="text-muted-foreground mt-2">Try searching for something else</p>
            </div>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Search;

