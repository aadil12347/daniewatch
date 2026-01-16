import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/PaginationBar";
import {
  getTVGenres,
  filterAdultContent,
  sortByReleaseAirDateDesc,
  Movie,
  Genre,
} from "@/lib/tmdb";

const MIN_RATING = 6; // 3 stars

const TVShows = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const page = Math.max(1, Number(new URLSearchParams(location.search).get("page") ?? "1") || 1);

  const [shows, setShows] = useState<Movie[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
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

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await getTVGenres();
        setGenres(response.genres);
      } catch (error) {
        console.error("Failed to fetch genres:", error);
      }
    };
    fetchGenres();
  }, []);

  const fetchShows = useCallback(
    async (pageNum: number) => {
      setIsLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];

        const params = new URLSearchParams({
          api_key: "fc6d85b3839330e3458701b975195487",
          include_adult: "false",
          page: pageNum.toString(),
          sort_by: "first_air_date.desc",
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

        if (selectedGenres.length > 0) {
          params.set("with_genres", selectedGenres.join(","));
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

        setShows(filteredResults);
        const fallbackTotalPages = Math.ceil((response.total_results || 0) / 20) || 1;
        setTotalPages(Math.max(1, Number(response.total_pages) || fallbackTotalPages));
      } catch (error) {
        console.error("Failed to fetch TV shows:", error);
        setShows([]);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedGenres, selectedYear],
  );

  // When filters change, reset to page 1 (skip initial mount so back button preserves page)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    // Important: do NOT depend on `page` here, otherwise changing pages would immediately reset back to 1.
    setPageParam(1, true);
  }, [selectedGenres, selectedYear, setPageParam]);

  useEffect(() => {
    fetchShows(page);
  }, [fetchShows, page]);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId],
    );
  };

  const clearGenres = () => setSelectedGenres([]);

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedYear(null);
    setPageParam(1);
  };

  const genresForNav = useMemo(
    () => genres.map((g) => ({ id: g.id, name: g.name })),
    [genres],
  );

  return (
    <>
      <Helmet>
        <title>TV Shows - DanieWatch</title>
        <meta
          name="description"
          content="Browse TV shows sorted by latest release date. Filter by genre and year."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">
            TV Shows
          </h1>

          <div className="mb-8">
            <CategoryNav
              genres={genresForNav}
              selectedGenres={selectedGenres}
              onGenreToggle={toggleGenre}
              onClearGenres={clearGenres}
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
              : shows.map((show, index) => (
                  <MovieCard
                    key={`${show.id}-${index}`}
                    movie={{ ...show, media_type: "tv" }}
                    animationDelay={Math.min(index * 30, 300)}
                  />
                ))}
          </div>

          {!isLoading && shows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No TV shows found with the selected filters.
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

export default TVShows;
