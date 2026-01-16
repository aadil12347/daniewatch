import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { Movie, filterAdultContent, sortByReleaseAirDateDesc } from "@/lib/tmdb";

const ANIME_GENRE_ID = 16; // Animation genre ID
const MIN_RATING = 6; // 3 stars

const ANIME_TAGS = [
  { id: "action", label: "Action", genreId: 10759 },
  { id: "comedy", label: "Comedy", genreId: 35 },
  { id: "drama", label: "Drama", genreId: 18 },
  { id: "fantasy", label: "Fantasy", genreId: 10765 },
  { id: "romance", label: "Romance", genreId: 10749 },
  { id: "mystery", label: "Mystery", genreId: 9648 },
  { id: "scifi", label: "Sci-Fi", genreId: 10765 },
  { id: "kids", label: "Kids", genreId: 10762 },
];

const Anime = () => {
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
      const next = new URLSearchParams(window.location.search);
      next.set("page", String(nextPage));
      setSearchParams(next, { replace });
    },
    [setSearchParams],
  );

  const fetchAnime = useCallback(
    async (pageNum: number) => {
      setIsLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const allGenres = [ANIME_GENRE_ID, ...selectedTags];

        const params = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "first_air_date.desc",
          with_genres: allGenres.join(","),
          with_original_language: "ja",
          "vote_average.gte": String(MIN_RATING),
          "vote_count.gte": "20",
          "first_air_date.lte": today,
        });

        if (selectedYear) {
          if (selectedYear === "older") {
            params.set("first_air_date.lte", "2019-12-31");
          } else {
            params.set("first_air_date_year", selectedYear);
          }
        }

        const res = await fetch(
          `https://api.themoviedb.org/3/discover/tv?${params}`,
        );
        const response = await res.json();

        const filteredResults = sortByReleaseAirDateDesc(
          filterAdultContent(response.results).filter(
            (m: Movie) => (m.vote_average ?? 0) >= MIN_RATING,
          ) as Movie[],
        );

        setItems(filteredResults);
        setTotalPages(Math.max(1, response.total_pages || 1));
      } catch (error) {
        console.error("Failed to fetch anime:", error);
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
    fetchAnime(page);
  }, [fetchAnime, page]);

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
    () => ANIME_TAGS.map((tag) => ({ id: tag.genreId, name: tag.label })),
    [],
  );

  return (
    <>
      <Helmet>
        <title>Anime - DanieWatch</title>
        <meta
          name="description"
          content="Watch the best anime series sorted by latest release. Filter by genre and year."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">
            Anime
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
                    key={`${item.id}-${index}`}
                    movie={{ ...item, media_type: "tv" }}
                    animationDelay={Math.min(index * 30, 300)}
                  />
                ))}
          </div>

          {!isLoading && items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No anime found with the selected filters.
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

export default Anime;
