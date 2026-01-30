import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";

import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import { Footer } from "@/components/Footer";
import { usePostModeration } from "@/hooks/usePostModeration";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { usePerformanceMode } from "@/contexts/PerformanceModeContext";
import { useHomepageCache } from "@/hooks/useHomepageCache";
import {
  getTrending,
  getPopularMovies,
  getTopRatedMovies,
  getPopularTV,
  getTopRatedTV,
  getAnimePopular,
  getKoreanPopular,
  filterAdultContent,
  Movie,
} from "@/lib/tmdb";

const Index = () => {
  const { isPerformance } = usePerformanceMode();
  const { saveCache, getCache } = useHomepageCache();
  
  const [trending, setTrending] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [popularTV, setPopularTV] = useState<Movie[]>([]);
  const [topRatedTV, setTopRatedTV] = useState<Movie[]>([]);
  const [animePopular, setAnimePopular] = useState<Movie[]>([]);
  const [koreanPopular, setKoreanPopular] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { filterBlockedPosts, sortWithPinnedFirst, isLoading: isModerationLoading } = usePostModeration();

  // Primary content is ready as soon as TMDB data is available (from cache or network)
  // Moderation filtering happens progressively after content renders
  const primaryContentReady = !isLoading && trending.length > 0;

  // Signal route ready immediately when TMDB data is available - don't wait for Supabase
  useRouteContentReady(primaryContentReady);

  useEffect(() => {
    // Try loading from session cache first
    const cached = getCache();
    console.log("[Index] useEffect ran, cache result:", cached ? "HIT" : "MISS");
    
    if (cached) {
      console.log("[Index] Loading from cache");
      setTrending(cached.trending);
      setPopularMovies(cached.popularMovies);
      setTopRatedMovies(cached.topRatedMovies);
      setPopularTV(cached.popularTV);
      setTopRatedTV(cached.topRatedTV);
      setAnimePopular(cached.animePopular);
      setKoreanPopular(cached.koreanPopular);
      setIsLoading(false);
      return;
    }

    // No cache, fetch fresh data
    console.log("[Index] Fetching fresh data from TMDB");
    const fetchData = async () => {
      try {
        const [
          trendingRes,
          popularMoviesRes,
          topRatedMoviesRes,
          popularTVRes,
          topRatedTVRes,
          animeRes,
          koreanRes,
        ] = await Promise.all([
          getTrending("day"),
          getPopularMovies(),
          getTopRatedMovies(),
          getPopularTV(),
          getTopRatedTV(),
          getAnimePopular(),
          getKoreanPopular(),
        ]);

        const trendingData = filterAdultContent(trendingRes.results);
        const popularMoviesData = filterAdultContent(popularMoviesRes.results);
        const topRatedMoviesData = filterAdultContent(topRatedMoviesRes.results);
        const popularTVData = filterAdultContent(popularTVRes.results);
        const topRatedTVData = filterAdultContent(topRatedTVRes.results);
        const animePopularData = filterAdultContent(animeRes.results);
        const koreanPopularData = filterAdultContent(koreanRes.results);

        setTrending(trendingData);
        setPopularMovies(popularMoviesData);
        setTopRatedMovies(topRatedMoviesData);
        setPopularTV(popularTVData);
        setTopRatedTV(topRatedTVData);
        setAnimePopular(animePopularData);
        setKoreanPopular(koreanPopularData);

        // Save to session cache for instant loads on revisit
        saveCache({
          trending: trendingData,
          popularMovies: popularMoviesData,
          topRatedMovies: topRatedMoviesData,
          popularTV: popularTVData,
          topRatedTV: topRatedTVData,
          animePopular: animePopularData,
          koreanPopular: koreanPopularData,
        });
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setFetchError("Failed to load homepage content. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {fetchError && primaryContentReady && (
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

        <HeroSection items={trending} isLoading={!primaryContentReady} />

        <div className="relative z-10 -mt-16">
          <ContentRow
            title="Top 10 Today"
            items={isModerationLoading ? trending.slice(0, 10) : sortWithPinnedFirst(filterBlockedPosts(trending.slice(0, 10)), "home")}
            isLoading={!primaryContentReady}
            showRank
            size="lg"
            hoverCharacterMode="contained"
            enableHoverPortal={false}
            disableRankFillHover={isPerformance}
            disableHoverLogo={isPerformance}
            disableHoverCharacter={isPerformance}
          />

          <TabbedContentRow
            title="Trending Now"
            moviesItems={isModerationLoading 
              ? trending.filter((item) => item.media_type === "movie")
              : filterBlockedPosts(trending.filter((item) => item.media_type === "movie"), "movie")}
            tvItems={isModerationLoading
              ? trending.filter((item) => item.media_type === "tv")
              : filterBlockedPosts(trending.filter((item) => item.media_type === "tv"), "tv")}
            isLoading={!primaryContentReady}
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          <TabbedContentRow
            title="Popular"
            moviesItems={isModerationLoading ? popularMovies : filterBlockedPosts(popularMovies, "movie")}
            tvItems={isModerationLoading ? popularTV : filterBlockedPosts(popularTV, "tv")}
            isLoading={!primaryContentReady}
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          {/* Regional Popular Sections */}
          <TabbedContentRow
            title="Anime Popular"
            moviesItems={isModerationLoading
              ? animePopular.filter((item) => item.media_type === "movie")
              : filterBlockedPosts(animePopular.filter((item) => item.media_type === "movie"), "movie")}
            tvItems={isModerationLoading
              ? animePopular.filter((item) => item.media_type === "tv")
              : filterBlockedPosts(animePopular.filter((item) => item.media_type === "tv"), "tv")}
            isLoading={!primaryContentReady}
            defaultTab="tv"
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          <TabbedContentRow
            title="Korean Popular"
            moviesItems={isModerationLoading
              ? koreanPopular.filter((item) => item.media_type === "movie")
              : filterBlockedPosts(koreanPopular.filter((item) => item.media_type === "movie"), "movie")}
            tvItems={isModerationLoading
              ? koreanPopular.filter((item) => item.media_type === "tv")
              : filterBlockedPosts(koreanPopular.filter((item) => item.media_type === "tv"), "tv")}
            isLoading={!primaryContentReady}
            defaultTab="tv"
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          <TabbedContentRow
            title="Top Rated"
            moviesItems={isModerationLoading ? topRatedMovies : filterBlockedPosts(topRatedMovies, "movie")}
            tvItems={isModerationLoading ? topRatedTV : filterBlockedPosts(topRatedTV, "tv")}
            isLoading={!primaryContentReady}
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Index;
