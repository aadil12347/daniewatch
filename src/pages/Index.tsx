import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import { Footer } from "@/components/Footer";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import {
  getTrending,
  getPopularMovies,
  getTopRatedMovies,
  getPopularTV,
  getTopRatedTV,
  getIndianPopular,
  getAnimePopular,
  getKoreanPopular,
  Movie,
} from "@/lib/tmdb";

const Index = () => {
  const [trending, setTrending] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [popularTV, setPopularTV] = useState<Movie[]>([]);
  const [topRatedTV, setTopRatedTV] = useState<Movie[]>([]);
  const [indianPopular, setIndianPopular] = useState<Movie[]>([]);
  const [animePopular, setAnimePopular] = useState<Movie[]>([]);
  const [koreanPopular, setKoreanPopular] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Enable scroll restoration for Index page
  useScrollRestoration(!isLoading);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          trendingRes,
          popularMoviesRes,
          topRatedMoviesRes,
          popularTVRes,
          topRatedTVRes,
          indianRes,
          animeRes,
          koreanRes,
        ] = await Promise.all([
          getTrending("day"),
          getPopularMovies(),
          getTopRatedMovies(),
          getPopularTV(),
          getTopRatedTV(),
          getIndianPopular(),
          getAnimePopular(),
          getKoreanPopular(),
        ]);

        setTrending(trendingRes.results);
        setPopularMovies(popularMoviesRes.results);
        setTopRatedMovies(topRatedMoviesRes.results);
        setPopularTV(popularTVRes.results);
        setTopRatedTV(topRatedTVRes.results);
        setIndianPopular(indianRes.results);
        setAnimePopular(animeRes.results);
        setKoreanPopular(koreanRes.results);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <Helmet>
        <title>DanieWatch - Watch Movies & TV Shows Online Free</title>
        <meta
          name="description"
          content="Discover and stream millions of movies and TV shows. Get the latest information about trending content, top-rated films, and popular series."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <HeroSection items={trending} isLoading={isLoading} />

        <div className="relative z-10 -mt-16">
          <ContentRow
            title="Top 10 Today"
            items={trending.slice(0, 10)}
            isLoading={isLoading}
            showRank
            size="lg"
          />

          <TabbedContentRow
            title="Trending Now"
            moviesItems={trending.filter(item => item.media_type === 'movie')}
            tvItems={trending.filter(item => item.media_type === 'tv')}
            isLoading={isLoading}
          />

          <TabbedContentRow
            title="Popular"
            moviesItems={popularMovies}
            tvItems={popularTV}
            isLoading={isLoading}
          />

          {/* Regional Popular Sections */}
          <TabbedContentRow
            title="Indian Popular"
            moviesItems={indianPopular.filter(item => item.media_type === 'movie')}
            tvItems={indianPopular.filter(item => item.media_type === 'tv')}
            isLoading={isLoading}
          />

          <TabbedContentRow
            title="Anime Popular"
            moviesItems={animePopular.filter(item => item.media_type === 'movie')}
            tvItems={animePopular.filter(item => item.media_type === 'tv')}
            isLoading={isLoading}
            defaultTab="tv"
          />

          <TabbedContentRow
            title="Korean Popular"
            moviesItems={koreanPopular.filter(item => item.media_type === 'movie')}
            tvItems={koreanPopular.filter(item => item.media_type === 'tv')}
            isLoading={isLoading}
            defaultTab="tv"
          />

          <TabbedContentRow
            title="Top Rated"
            moviesItems={topRatedMovies}
            tvItems={topRatedTV}
            isLoading={isLoading}
          />
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Index;