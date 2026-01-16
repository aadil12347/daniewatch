import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CategoryNav } from "@/components/CategoryNav";
import { StandardRails } from "@/components/browse/StandardRails";
import { YearGroupedInfinite } from "@/components/browse/YearGroupedInfinite";

// Anime-specific sub-genres/tags
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
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const toggleTag = (genreId: number) => {
    setSelectedTags((prev) => (prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]));
  };

  const clearTags = () => setSelectedTags([]);
  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedYear(null);
  };

  const genresForNav = ANIME_TAGS.map((tag) => ({ id: tag.genreId, name: tag.label }));

  return (
    <>
      <Helmet>
        <title>Anime - DanieWatch</title>
        <meta name="description" content="Watch anime by year with infinite scrolling. Filter by genre and year." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">Anime</h1>

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

          <StandardRails mode="anime" />

          <YearGroupedInfinite mode="anime" mediaScope="tv" selectedGenres={selectedTags} selectedYear={selectedYear} />

          <StandardRails mode="anime" titlePrefix="More" />

          {(selectedTags.length > 0 || selectedYear) && (
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

export default Anime;

