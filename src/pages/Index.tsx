import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";

import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import { Footer } from "@/components/Footer";
import { usePostModeration } from "@/hooks/usePostModeration";
import {
  getTrending,
  getPopularMovies,
  getTopRatedMovies,
  getPopularTV,
  getTopRatedTV,
  getIndianPopular,
  getAnimePopular,
  getKoreanPopular,
  filterAdultContent,
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
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { filterBlockedPosts, sortWithPinnedFirst, isLoading: isModerationLoading } = usePostModeration();
  const pageIsLoading = isLoading || isModerationLoading;

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

        setTrending(filterAdultContent(trendingRes.results));
        setPopularMovies(filterAdultContent(popularMoviesRes.results));
        setTopRatedMovies(filterAdultContent(topRatedMoviesRes.results));
        setPopularTV(filterAdultContent(popularTVRes.results));
        setTopRatedTV(filterAdultContent(topRatedTVRes.results));
        setIndianPopular(filterAdultContent(indianRes.results));
        setAnimePopular(filterAdultContent(animeRes.results));
        setKoreanPopular(filterAdultContent(koreanRes.results));
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setFetchError("Failed to load homepage content. Please try again.");
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
        {fetchError && !pageIsLoading && (
          <div className="container mx-auto px-4 pt-24">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">{fetchError}</p>
              <button
                type="button"
                className="mt-3 text-sm font-medium story-link"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        )}

        <HeroSection items={trending} isLoading={pageIsLoading} />

        <div className="relative z-10 -mt-16">
          <ContentRow
            title="Top 10 Today"
            items={sortWithPinnedFirst(filterBlockedPosts(trending.slice(0, 10)), 'home')}
            isLoading={pageIsLoading}
            showRank
            size="lg"
          />

          <TabbedContentRow
            title="Trending Now"
            moviesItems={filterBlockedPosts(trending.filter(item => item.media_type === 'movie'), 'movie')}
            tvItems={filterBlockedPosts(trending.filter(item => item.media_type === 'tv'), 'tv')}
             isLoading={pageIsLoading}
          />

          <TabbedContentRow
            title="Popular"
            moviesItems={filterBlockedPosts(popularMovies, 'movie')}
            tvItems={filterBlockedPosts(popularTV, 'tv')}
             isLoading={pageIsLoading}
          />

          {/* Regional Popular Sections */}
          <TabbedContentRow
            title="Indian Popular"
            moviesItems={filterBlockedPosts(indianPopular.filter(item => item.media_type === 'movie'), 'movie')}
            tvItems={filterBlockedPosts(indianPopular.filter(item => item.media_type === 'tv'), 'tv')}
             isLoading={pageIsLoading}
          />

          <TabbedContentRow
            title="Anime Popular"
            moviesItems={filterBlockedPosts(animePopular.filter(item => item.media_type === 'movie'), 'movie')}
            tvItems={filterBlockedPosts(animePopular.filter(item => item.media_type === 'tv'), 'tv')}
             isLoading={pageIsLoading}
            defaultTab="tv"
          />

          <TabbedContentRow
            title="Korean Popular"
            moviesItems={filterBlockedPosts(koreanPopular.filter(item => item.media_type === 'movie'), 'movie')}
            tvItems={filterBlockedPosts(koreanPopular.filter(item => item.media_type === 'tv'), 'tv')}
             isLoading={pageIsLoading}
            defaultTab="tv"
          />

          <TabbedContentRow
            title="Top Rated"
            moviesItems={filterBlockedPosts(topRatedMovies, 'movie')}
            tvItems={filterBlockedPosts(topRatedTV, 'tv')}
            isLoading={pageIsLoading}
          />
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Index;