import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";

import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import { DbContentRow } from "@/components/DbContentRow";
import { Footer } from "@/components/Footer";
import { usePostModeration } from "@/hooks/usePostModeration";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { usePerformanceMode } from "@/contexts/PerformanceModeContext";
import { useHomepageCache } from "@/hooks/useHomepageCache";
import { useDbSections } from "@/hooks/useDbSections";
import {
  getTrending,
  getIndianPopular,
  getTopRatedMovies,
  getTopRatedTV,
  getAnimePopular,
  getKoreanPopular,
  filterAdultContent,
  Movie,
} from "@/lib/tmdb";

const Index = () => {
  const { isPerformance } = usePerformanceMode();
  const { saveCache, getCache } = useHomepageCache();
  const { sections: dbSections } = useDbSections();
  
  const [trending, setTrending] = useState<Movie[]>([]);
  const [indianPopular, setIndianPopular] = useState<Movie[]>([]);
  const [koreanPopular, setKoreanPopular] = useState<Movie[]>([]);
  const [animePopular, setAnimePopular] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [topRatedTV, setTopRatedTV] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { filterBlockedPosts, sortWithPinnedFirst, isLoading: isModerationLoading } = usePostModeration();

  // Primary content is ready as soon as TMDB data is available (from cache or network)
  const primaryContentReady = !isLoading && trending.length > 0;

  // Signal route ready immediately when TMDB data is available
  useRouteContentReady(primaryContentReady);

  useEffect(() => {
    // Try loading from session cache first
    const cached = getCache();
    console.log("[Index] useEffect ran, cache result:", cached ? "HIT" : "MISS");
    
    if (cached) {
      console.log("[Index] Loading from cache");
      setTrending(cached.trending);
      setIndianPopular(cached.indianPopular);
      setKoreanPopular(cached.koreanPopular);
      setAnimePopular(cached.animePopular);
      setTopRatedMovies(cached.topRatedMovies);
      setTopRatedTV(cached.topRatedTV);
      setIsLoading(false);
      return;
    }

    // No cache, fetch fresh data
    console.log("[Index] Fetching fresh data from TMDB");
    const fetchData = async () => {
      try {
        const [
          trendingRes,
          indianRes,
          koreanRes,
          animeRes,
          topRatedMoviesRes,
          topRatedTVRes,
        ] = await Promise.all([
          getTrending("day"),
          getIndianPopular(),
          getKoreanPopular(),
          getAnimePopular(),
          getTopRatedMovies(),
          getTopRatedTV(),
        ]);

        const trendingData = filterAdultContent(trendingRes.results);
        const indianData = filterAdultContent(indianRes.results);
        const koreanData = filterAdultContent(koreanRes.results);
        const animeData = filterAdultContent(animeRes.results);
        const topRatedMoviesData = filterAdultContent(topRatedMoviesRes.results);
        const topRatedTVData = filterAdultContent(topRatedTVRes.results);

        setTrending(trendingData);
        setIndianPopular(indianData);
        setKoreanPopular(koreanData);
        setAnimePopular(animeData);
        setTopRatedMovies(topRatedMoviesData);
        setTopRatedTV(topRatedTVData);

        // Save to session cache for instant loads on revisit
        saveCache({
          trending: trendingData,
          indianPopular: indianData,
          koreanPopular: koreanData,
          animePopular: animeData,
          topRatedMovies: topRatedMoviesData,
          topRatedTV: topRatedTVData,
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
          {/* Top 10 Today */}
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

          {/* Trending Now */}
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

          {/* Regional Sections - Attractive Names */}
          <TabbedContentRow
            title="Indian Hits"
            moviesItems={isModerationLoading
              ? indianPopular.filter((item) => item.media_type === "movie")
              : filterBlockedPosts(indianPopular.filter((item) => item.media_type === "movie"), "movie")}
            tvItems={isModerationLoading
              ? indianPopular.filter((item) => item.media_type === "tv")
              : filterBlockedPosts(indianPopular.filter((item) => item.media_type === "tv"), "tv")}
            isLoading={!primaryContentReady}
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          <TabbedContentRow
            title="Korean Wave"
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
            title="Anime Picks"
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

          {/* Database Sections - Lazy Loaded */}
          {dbSections.map((section) => (
            <DbContentRow
              key={section.id}
              title={section.title}
              items={section.items}
            />
          ))}

          {/* Top Rated - Closing Section */}
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
