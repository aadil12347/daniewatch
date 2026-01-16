import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { Movie, filterAdultContentStrict, sortByReleaseAirDateDesc } from "@/lib/tmdb";

const MIN_RATING = 6; // 3 stars

const INDIAN_TAGS = [
  { id: "drama", label: "Drama", genreId: 18 },
  { id: "romance", label: "Romance", genreId: 10749 },
  { id: "action", label: "Action", genreId: 28 },
  { id: "comedy", label: "Comedy", genreId: 35 },
  { id: "thriller", label: "Thriller", genreId: 53 },
  { id: "crime", label: "Crime", genreId: 80 },
  { id: "family", label: "Family", genreId: 10751 },
  { id: "musical", label: "Musical", genreId: 10402 },
];

const TV_ACTION_GENRE = 10759;

const Indian = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const page = Math.max(1, Number(new URLSearchParams(location.search).get("page") ?? "1") || 1);

  const [items, setItems] = useState<Movie[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const didMountRef = useRef(false);

  const setPageParam = useCallback(
    (nextPage: number, replace = false) => {
      const next = new URLSearchParams(location.search);
      next.set("page", String(nextPage));
      const search = next.toString();
      navigate(
        {
          pathname: location.pathname,
          search: search ? `?${search}` : "",
        },
        { replace },
      );
    },
    [location.pathname, location.search, navigate],
  );

  const fetchIndian = useCallback(
    async (pageNum: number) => {
      setIsLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];

        const movieGenres = selectedTags.join(",");
        const tvGenres = selectedTags.map((g) => (g === 28 ? TV_ACTION_GENRE : g)).join(",");

        const movieParams = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "primary_release_date.desc",
          with_origin_country: "IN",
          "vote_average.gte": String(MIN_RATING),
          "vote_count.gte": "50",
          "primary_release_date.lte": today,
        });

        const tvParams = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "first_air_date.desc",
          with_origin_country: "IN",
          "vote_average.gte": String(MIN_RATING),
          "vote_count.gte": "20",
          "first_air_date.lte": today,
        });

        if (selectedYear) {
          if (selectedYear === "older") {
            movieParams.set("primary_release_date.lte", "2019-12-31");
            tvParams.set("first_air_date.lte", "2019-12-31");
          } else {
            movieParams.set("primary_release_year", selectedYear);
            tvParams.set("first_air_date_year", selectedYear);
          }
        }

        if (selectedTags.length > 0) {
          movieParams.set("with_genres", movieGenres);
          tvParams.set("with_genres", tvGenres);
        }

        const [moviesRes, tvRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/discover/movie?${movieParams}`),
          fetch(`https://api.themoviedb.org/3/discover/tv?${tvParams}`),
        ]);

        const [moviesData, tvData] = await Promise.all([
          moviesRes.json(),
          tvRes.json(),
        ]);

        const combined = [
          ...(moviesData.results || []).map((m: Movie) => ({
            ...m,
            media_type: "movie" as const,
          })),
          ...(tvData.results || []).map((t: Movie) => ({
            ...t,
            media_type: "tv" as const,
          })),
        ];

        const combinedResults = await filterAdultContentStrict(combined);
        const minRated = combinedResults.filter(
          (m) => (m.vote_average ?? 0) >= MIN_RATING,
        );

        const sorted = sortByReleaseAirDateDesc(minRated).slice(0, 20);

        setItems(sorted);

        const moviesFallback = Math.ceil((moviesData.total_results || 0) / 20) || 1;
        const tvFallback = Math.ceil((tvData.total_results || 0) / 20) || 1;
        const moviesPages = Math.max(1, Number(moviesData.total_pages) || moviesFallback);
        const tvPages = Math.max(1, Number(tvData.total_pages) || tvFallback);

        setTotalPages(Math.max(1, Math.max(moviesPages, tvPages)));
      } catch (error) {
        console.error("Failed to fetch Indian content:", error);
        setItems([]);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedTags, selectedYear],
  );

  // When filters change, reset to page 1 (skip initial mount so back button preserves page)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    // Important: do NOT depend on `page` here, otherwise changing pages would immediately reset back to 1.
    setPageParam(1, true);
  }, [selectedTags, selectedYear, setPageParam]);

  useEffect(() => {
    fetchIndian(page);
  }, [fetchIndian, page]);

  const toggleTag = (genreId: number) => {
    setSelectedTags((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId],
    );
  };

  const clearTags = () => setSelectedTags([]);

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedYear(null);
    setPageParam(1);
  };

  const genresForNav = useMemo(
    () => INDIAN_TAGS.map((tag) => ({ id: tag.genreId, name: tag.label })),
    [],
  );

  return (
    <>
      <Helmet>
        <title>Indian Movies & TV - DanieWatch</title>
        <meta
          name="description"
          content="Watch the best Indian movies and TV series sorted by latest release. Filter by genre and year."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">
            Indian
          </h1>

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

          {!isLoading && items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No Indian content found with the selected filters.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          <div className="py-10">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              onPageChange={(p) => setPageParam(p)}
            />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Indian;
