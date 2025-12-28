import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getPopularTV, getTopRatedTV, Movie } from "@/lib/tmdb";

const TVShows = () => {
  const [shows, setShows] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"popular" | "top_rated">("popular");

  useEffect(() => {
    const fetchShows = async () => {
      setIsLoading(true);
      try {
        const response = activeTab === "top_rated" ? await getTopRatedTV() : await getPopularTV();
        setShows(response.results);
      } catch (error) {
        console.error("Failed to fetch TV shows:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShows();
  }, [activeTab]);

  const tabs = [
    { key: "popular", label: "Popular" },
    { key: "top_rated", label: "Top Rated" },
  ] as const;

  return (
    <>
      <Helmet>
        <title>TV Shows - Cineby</title>
        <meta name="description" content="Browse popular and top rated TV shows." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">TV Shows</h1>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "gradient-red text-foreground"
                    : "bg-secondary/50 hover:bg-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {isLoading
              ? Array.from({ length: 18 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="aspect-[2/3] rounded-xl" />
                    <Skeleton className="h-4 w-3/4 mt-3" />
                    <Skeleton className="h-3 w-1/2 mt-2" />
                  </div>
                ))
              : shows.map((show) => (
                  <MovieCard key={show.id} movie={{ ...show, media_type: "tv" }} />
                ))}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default TVShows;
