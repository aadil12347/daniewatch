import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CategoryNav } from "@/components/CategoryNav";
import { StandardRails } from "@/components/browse/StandardRails";
import { YearGroupedInfinite } from "@/components/browse/YearGroupedInfinite";

// Indian content genres
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

const Indian = () => {
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

  const genresForNav = INDIAN_TAGS.map((tag) => ({ id: tag.genreId, name: tag.label }));

  return (
    <>
      <Helmet>
        <title>Indian Movies & TV - DanieWatch</title>
        <meta name="description" content="Watch Indian movies and TV by year with infinite scrolling. Filter by genre and year." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">Indian</h1>

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

          <StandardRails mode="indian" />

          <YearGroupedInfinite mode="indian" mediaScope="mixed" selectedGenres={selectedTags} selectedYear={selectedYear} />

          <StandardRails mode="indian" titlePrefix="More" />

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

export default Indian;

