import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";


import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import { usePostModeration } from "@/hooks/usePostModeration";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { usePreloadImages } from "@/hooks/usePreloadImages";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { usePerformanceMode } from "@/contexts/PerformanceModeContext";
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

  // Build an “above the fold” list of cards and preload their hover images first.
  const aboveFoldIds = useMemo(() => {
    const ids: number[] = [];
    const pushMany = (arr: Movie[]) => {
      for (const m of arr) {
        if (ids.length >= ABOVE_FOLD_PRELOAD_COUNT) break;
        ids.push(m.id);
      }
    };

    // Rough “what users see first” order
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
  // IMPORTANT: always release the global route loader once the page has settled,
  // even if the homepage API request fails (otherwise the loader will hit the hard timeout every visit).
  useRouteContentReady(!pageIsLoading && (fetchError !== null || trending.length > 0));

  useEffect(() => {
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

        setTrending(filterAdultContent(trendingRes.results));
        setPopularMovies(filterAdultContent(popularMoviesRes.results));
        setTopRatedMovies(filterAdultContent(topRatedMoviesRes.results));
        setPopularTV(filterAdultContent(popularTVRes.results));
        setTopRatedTV(filterAdultContent(topRatedTVRes.results));
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

      <main className="min-h-[100dvh] bg-background overflow-x-hidden flex flex-col">
        {fetchError && !pageIsLoading && (
          <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 pt-[calc(var(--app-header-offset)+24px)]">
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

        <div className="relative z-10 -mt-16 w-full px-3 sm:px-4 md:px-6 lg:px-8">
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

      </main>
    </>
  );
};

export default Index;
