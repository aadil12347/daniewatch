import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ContentRow } from "@/components/ContentRow";
import { MovieCard } from "@/components/MovieCard";
import { discoverTV, Movie } from "@/lib/tmdb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ANIME_GENRE_ID = 16; // Animation genre ID

const Anime = () => {
  const [activeTab, setActiveTab] = useState("popular");

  const { data: popularAnime, isLoading: loadingPopular } = useQuery({
    queryKey: ["anime", "popular"],
    queryFn: () => discoverTV(1, [ANIME_GENRE_ID], "popularity.desc"),
  });

  const { data: topRatedAnime, isLoading: loadingTopRated } = useQuery({
    queryKey: ["anime", "top_rated"],
    queryFn: () => discoverTV(1, [ANIME_GENRE_ID], "vote_average.desc"),
  });

  const { data: newAnime, isLoading: loadingNew } = useQuery({
    queryKey: ["anime", "new"],
    queryFn: () => discoverTV(1, [ANIME_GENRE_ID], "first_air_date.desc"),
  });

  const getActiveData = (): { items: Movie[]; isLoading: boolean } => {
    switch (activeTab) {
      case "top_rated":
        return { items: topRatedAnime?.results || [], isLoading: loadingTopRated };
      case "new":
        return { items: newAnime?.results || [], isLoading: loadingNew };
      default:
        return { items: popularAnime?.results || [], isLoading: loadingPopular };
    }
  };

  const { items, isLoading } = getActiveData();

  return (
    <>
      <Helmet>
        <title>Anime - Cineby</title>
        <meta name="description" content="Watch the best anime series and movies" />
      </Helmet>

      <Navbar />

      <main className="min-h-screen pt-20 pb-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Anime</h1>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="top_rated">Top Rated</TabsTrigger>
              <TabsTrigger value="new">New Releases</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {isLoading
              ? Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
                ))
              : items.map((item) => (
                  <MovieCard key={item.id} movie={{ ...item, media_type: "tv" }} size="md" />
                ))}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default Anime;
