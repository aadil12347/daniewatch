import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { Movie, filterAdultContentStrict, sortByReleaseAirDateDesc } from "@/lib/tmdb";

const MIN_RATING = 6; // 3 stars

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

const TV_ACTION_GENRE = 10759;
const TV_FANTASY_GENRE = 10765;

const Korean = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [items, setItems] = useState<Movie[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const didMountRef = useRef(false);

  const setPageParam = useCallback(
    (nextPage: number, replace = false) => {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(nextPage));
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams],
  );

  const fetchKorean = useCallback(
    async (pageNum: number) => {
      setIsLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];

        const movieGenres = selectedTags.join(",");
        const tvGenres = selectedTags
          .map((g) => {
            if (g === 28) return TV_ACTION_GENRE;
            if (g === 14) return TV_FANTASY_GENRE;
            return g;
          })
          .join(",");

        const movieParams = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "primary_release_date.desc",
          with_original_language: "ko",
          "vote_average.gte": String(MIN_RATING),
          "vote_count.gte": "50",
          "primary_release_date.lte": today,
        });

        const tvParams = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "first_air_date.desc",
          with_original_language: "ko",
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
        setTotalPages(
          Math.max(1, Math.max(moviesData.total_pages || 1, tvData.total_pages || 1)),
        );
      } catch (error) {
        console.error("Failed to fetch Korean content:", error);
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
    fetchKorean(page);
  }, [fetchKorean, page]);

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
    () => KOREAN_TAGS.map((tag) => ({ id: tag.genreId, name: tag.label })),
    [],
  );

  return (
    <>
      <Helmet>
        <title>Korean Movies & TV - DanieWatch</title>
        <meta
          name="description"
          content="Watch the best Korean movies and TV series sorted by latest release. Filter by genre and year."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">
            Korean
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
                No Korean content found with the selected filters.
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

export default Korean;
