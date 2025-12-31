import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import { Footer } from "@/components/Footer";
import {
  getTrending,
  getPopularMovies,
  getTopRatedMovies,
  getPopularTV,
  getTopRatedTV,
  getIndianTrending,
  getAnimeTrending,
  getKoreanTrending,
  Movie,
} from "@/lib/tmdb";

const Index = () => {
  const [trending, setTrending] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [popularTV, setPopularTV] = useState<Movie[]>([]);
  const [topRatedTV, setTopRatedTV] = useState<Movie[]>([]);
  const [indianTrending, setIndianTrending] = useState<Movie[]>([]);
  const [animeTrending, setAnimeTrending] = useState<Movie[]>([]);
  const [koreanTrending, setKoreanTrending] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          getIndianTrending(),
          getAnimeTrending(),
          getKoreanTrending(),
        ]);

        setTrending(trendingRes.results);
        setPopularMovies(popularMoviesRes.results);
        setTopRatedMovies(topRatedMoviesRes.results);
        setPopularTV(popularTVRes.results);
        setTopRatedTV(topRatedTVRes.results);
        setIndianTrending(indianRes.results);
        setAnimeTrending(animeRes.results);
        setKoreanTrending(koreanRes.results);
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

          {/* Regional Trending Sections */}
          <TabbedContentRow
            title="🇮🇳 Indian Trending"
            moviesItems={indianTrending.filter(item => item.media_type === 'movie')}
            tvItems={indianTrending.filter(item => item.media_type === 'tv')}
            isLoading={isLoading}
          />

          <TabbedContentRow
            title="🎌 Anime Trending"
            moviesItems={animeTrending.filter(item => item.media_type === 'movie')}
            tvItems={animeTrending.filter(item => item.media_type === 'tv')}
            isLoading={isLoading}
          />

          <TabbedContentRow
            title="🇰🇷 Korean Trending"
            moviesItems={koreanTrending.filter(item => item.media_type === 'movie')}
            tvItems={koreanTrending.filter(item => item.media_type === 'tv')}
            isLoading={isLoading}
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