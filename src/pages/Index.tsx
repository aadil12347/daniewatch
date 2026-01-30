import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";

import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import { Footer } from "@/components/Footer";
import { usePostModeration } from "@/hooks/usePostModeration";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { usePreloadImages } from "@/hooks/usePreloadImages";
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

const ABOVE_FOLD_PRELOAD_COUNT = 20; // preload at least 20 hover images on initial load
const SHOW_THRESHOLD = 0.5; // show when 50% of those hover images are ready

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
  const { getHoverImageUrl, isLoading: isAvailabilityLoading } = useEntryAvailability();

  // Build an "above the fold" list of cards and preload their hover images first.
  const aboveFoldIds = useMemo(() => {
    const ids: number[] = [];
    const pushMany = (arr: Movie[]) => {
      for (const m of arr) {
        if (ids.length >= ABOVE_FOLD_PRELOAD_COUNT) break;
        ids.push(m.id);
      }
    };

    // Rough "what users see first" order
    pushMany(trending.slice(0, 10));
    pushMany(trending);
    pushMany(popularMovies);
    pushMany(popularTV);

    return ids;
  }, [popularMovies, popularTV, trending]);

  const aboveFoldHoverUrls = useMemo(
    () => aboveFoldIds.map((id) => getHoverImageUrl(id)).filter(Boolean),
    [aboveFoldIds, getHoverImageUrl]
  );

  const { loaded: hoverLoaded, total: hoverTotal } = usePreloadImages(aboveFoldHoverUrls, {
    enabled: !isLoading && !isAvailabilityLoading, // start once TMDB lists + entries map are ready
    concurrency: 8,
  });

  const aboveFoldReady = hoverTotal === 0 ? true : hoverLoaded / hoverTotal >= SHOW_THRESHOLD;
  const pageIsLoading = isLoading || isModerationLoading || isAvailabilityLoading || !aboveFoldReady;

  // Home exception: keep loader until Hero + Top 10 are ready.
  useRouteContentReady(!pageIsLoading && trending.length >= Math.min(10, trending.length || 10));

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
            items={sortWithPinnedFirst(filterBlockedPosts(trending.slice(0, 10)), "home")}
            isLoading={pageIsLoading}
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
            moviesItems={filterBlockedPosts(
              trending.filter((item) => item.media_type === "movie"),
              "movie"
            )}
            tvItems={filterBlockedPosts(
              trending.filter((item) => item.media_type === "tv"),
              "tv"
            )}
            isLoading={pageIsLoading}
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          <TabbedContentRow
            title="Popular"
            moviesItems={filterBlockedPosts(popularMovies, "movie")}
            tvItems={filterBlockedPosts(popularTV, "tv")}
            isLoading={pageIsLoading}
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          {/* Regional Popular Sections */}
          <TabbedContentRow
            title="Anime Popular"
            moviesItems={filterBlockedPosts(
              animePopular.filter((item) => item.media_type === "movie"),
              "movie"
            )}
            tvItems={filterBlockedPosts(
              animePopular.filter((item) => item.media_type === "tv"),
              "tv"
            )}
            isLoading={pageIsLoading}
            defaultTab="tv"
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          <TabbedContentRow
            title="Anime Popular"
            moviesItems={filterBlockedPosts(
              animePopular.filter((item) => item.media_type === "movie"),
              "movie"
            )}
            tvItems={filterBlockedPosts(
              animePopular.filter((item) => item.media_type === "tv"),
              "tv"
            )}
            isLoading={pageIsLoading}
            defaultTab="tv"
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          <TabbedContentRow
            title="Korean Popular"
            moviesItems={filterBlockedPosts(
              koreanPopular.filter((item) => item.media_type === "movie"),
              "movie"
            )}
            tvItems={filterBlockedPosts(
              koreanPopular.filter((item) => item.media_type === "tv"),
              "tv"
            )}
            isLoading={pageIsLoading}
            defaultTab="tv"
            hoverCharacterMode="contained"
            enableHoverPortal={false}
          />

          <TabbedContentRow
            title="Top Rated"
            moviesItems={filterBlockedPosts(topRatedMovies, "movie")}
            tvItems={filterBlockedPosts(topRatedTV, "tv")}
            isLoading={pageIsLoading}
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
