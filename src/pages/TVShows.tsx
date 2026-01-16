import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CategoryNav } from "@/components/CategoryNav";
import { getTVGenres, Genre } from "@/lib/tmdb";
import { StandardRails } from "@/components/browse/StandardRails";
import { YearGroupedInfinite } from "@/components/browse/YearGroupedInfinite";

const TVShows = () => {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

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

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) => (prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]));
  };

  const clearGenres = () => setSelectedGenres([]);
  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedYear(null);
  };

  const genresForNav = genres.map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <Helmet>
        <title>TV Shows - DanieWatch</title>
        <meta name="description" content="Browse TV shows by year with infinite scrolling. Filter by genre and year." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">TV Shows</h1>

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

          <StandardRails mode="global" />

          <YearGroupedInfinite mode="global" mediaScope="tv" selectedGenres={selectedGenres} selectedYear={selectedYear} />

          <StandardRails mode="global" titlePrefix="More" />

          {(selectedGenres.length > 0 || selectedYear) && (
            <div className="text-center py-8">
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
};

export default TVShows;

