import { useEffect, useState, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";

import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import { DbContentRow } from "@/components/DbContentRow";
import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";
import { Footer } from "@/components/Footer";
import { usePostModeration } from "@/hooks/usePostModeration";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { usePerformanceMode } from "@/contexts/PerformanceModeContext";
import { useHomepageCache } from "@/hooks/useHomepageCache";
import { useDbSections } from "@/hooks/useDbSections";
import { useTrendingFromDb } from "@/hooks/useTrendingFromDb";
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
import { useContentAccess } from "@/hooks/useContentAccess";
import { getCuratedMovieSitePosts, preResolvePosts } from "@/lib/movieSiteScraper";

const Index = () => {
  const { isPerformance } = usePerformanceMode();
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const restoreScrollYRef = useRef<number | null>(null);
  const { saveCache, getCache } = useHomepageCache();
  const { sections: dbSections } = useDbSections();

  // Top 10 trending from database - updated daily via manifest
  const { trendingItems: dbTrendingItems, isLoading: isTrendingLoading } = useTrendingFromDb();

  const [trending, setTrending] = useState<Movie[]>([]);
  const [indianPopular, setIndianPopular] = useState<Movie[]>([]);
  const [koreanPopular, setKoreanPopular] = useState<Movie[]>([]);
  const [animePopular, setAnimePopular] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [topRatedTV, setTopRatedTV] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { filterBlockedPosts, sortWithPinnedFirst, isLoading: isModerationLoading } = usePostModeration();
  const { filterForRole } = useContentAccess();

  // Apply role-based filtering: non-admins only see DB-backed items
  // For carousel sections, ensure minimum 10 items
  const visibleTrending = useMemo(() => filterForRole(trending), [trending, filterForRole]);
  const visibleIndian = useMemo(() => filterForRole(indianPopular).length >= 10 ? filterForRole(indianPopular) : [], [indianPopular, filterForRole]);
  const visibleKorean = useMemo(() => filterForRole(koreanPopular).length >= 10 ? filterForRole(koreanPopular) : [], [koreanPopular, filterForRole]);
  const visibleAnime = useMemo(() => filterForRole(animePopular).length >= 10 ? filterForRole(animePopular) : [], [animePopular, filterForRole]);
  const visibleTopMovies = useMemo(() => filterForRole(topRatedMovies), [topRatedMovies, filterForRole]);
  const visibleTopTV = useMemo(() => filterForRole(topRatedTV), [topRatedTV, filterForRole]);

  const [curatedTop5, setCuratedTop5] = useState<Movie[]>([]);
  const [curatedTop10, setCuratedTop10] = useState<Movie[]>([]);
  const [curatedVega, setCuratedVega] = useState<Movie[]>([]);
  const [curatedRog, setCuratedRog] = useState<Movie[]>([]);
  const [curatedSeries, setCuratedSeries] = useState<Movie[]>([]);
  const [curatedMovies, setCuratedMovies] = useState<Movie[]>([]);
  const [isCuratedLoading, setIsCuratedLoading] = useState(true);

  // Fetch VegaMovies & RogMovies posts strictly (exclude all other sites)
  useEffect(() => {
    let isCancelled = false;

    async function loadCuratedSitePosts() {
      try {
        setIsCuratedLoading(true);
        const { top5, top10, vegaPosts, rogPosts, seriesPosts, moviePosts } =
          await getCuratedMovieSitePosts();
        if (isCancelled) return;

        setCuratedTop5(top5);
        setCuratedTop10(top10);
        setCuratedVega(vegaPosts);
        setCuratedRog(rogPosts);
        setCuratedSeries(seriesPosts);
        setCuratedMovies(moviePosts);
        setIsCuratedLoading(false);

        // Background pre-resolve IMDb and TMDB IDs
        void preResolvePosts([...top5, ...top10, ...vegaPosts, ...rogPosts], (updatedMovie) => {
          if (isCancelled) return;
          const updater = (prev: Movie[]) =>
            prev.map((m) => (m.post_url === updatedMovie.post_url ? updatedMovie : m));

          setCuratedTop5(updater);
          setCuratedTop10(updater);
          setCuratedVega(updater);
          setCuratedRog(updater);
          setCuratedSeries(updater);
          setCuratedMovies(updater);
        });
      } catch (e) {
        console.error("[Index] Failed to load VegaMovies/RogMovies posts:", e);
        if (!isCancelled) setIsCuratedLoading(false);
      }
    }

    void loadCuratedSitePosts();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Primary content is ready as soon as TMDB or curated data is available
  const primaryContentReady = (!isLoading && trending.length > 0) || curatedTop5.length > 0;

  // Signal route ready immediately when primary content is available
  useRouteContentReady(primaryContentReady);

  useEffect(() => {
    // Try loading from session cache first
    const cached = getCache();
    console.log("[Index] useEffect ran, cache result:", cached ? "HIT" : "MISS");

    // Only use cache if it has the new structure (indianPopular exists)
    if (cached && cached.indianPopular) {
      console.log("[Index] Loading from cache");
      setTrending(cached.trending || []);
      setIndianPopular(cached.indianPopular || []);
      setKoreanPopular(cached.koreanPopular || []);
      setAnimePopular(cached.animePopular || []);
      setTopRatedMovies(cached.topRatedMovies || []);
      setTopRatedTV(cached.topRatedTV || []);
      setIsLoading(false);
      setIsRestoredFromCache(true);

      if (cached.scrollY) {
        restoreScrollYRef.current = cached.scrollY;
      }
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

    void fetchData();
  }, [getCache, saveCache]);

  // Restore scroll position after content is loaded and rendered
  useEffect(() => {
    if (isRestoredFromCache && restoreScrollYRef.current !== null) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: restoreScrollYRef.current!, left: 0, behavior: "auto" });
          restoreScrollYRef.current = null; // Clear ref after restoring
        });
      });
    }
  }, [isRestoredFromCache]);

  // Save on scroll (debounced)
  useEffect(() => {
    if (isLoading || trending.length === 0) return;

    const handleScroll = () => {
      saveCache({
        trending,
        indianPopular,
        koreanPopular,
        animePopular,
        topRatedMovies,
        topRatedTV,
        scrollY: window.scrollY,
      });
    };

    const debouncedScroll = () => {
      const h = window.setTimeout(handleScroll, 1000);
      return () => window.clearTimeout(h);
    };

    window.addEventListener("scroll", debouncedScroll, { passive: true });
    return () => window.removeEventListener("scroll", debouncedScroll);
  }, [trending, indianPopular, koreanPopular, animePopular, topRatedMovies, topRatedTV, saveCache, isLoading]);

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

        <HeroSection
          items={curatedTop5.length > 0 ? curatedTop5 : visibleTrending}
          isLoading={isCuratedLoading && !primaryContentReady}
        />

        <div className="relative z-10 -mt-16">
          {/* Continue Watching - High Priority Row */}
          <ContinueWatchingRow />

          {/* Top 10 Today — VegaMovies & RogMovies interleaved side-by-side (1 Vega, 1 Rog) */}
          <ContentRow
            title="Top 10 Today"
            items={
              curatedTop10.length >= 10
                ? curatedTop10
                : isModerationLoading
                ? dbTrendingItems
                : sortWithPinnedFirst(filterBlockedPosts(dbTrendingItems), "home")
            }
            isLoading={isCuratedLoading && isTrendingLoading}
            showRank
            size="lg"
            hoverCharacterMode="contained"
            enableHoverPortal={false}
            disableRankFillHover={isPerformance}
            disableHoverLogo={isPerformance}
            disableHoverCharacter={isPerformance}
          />

          {/* Latest from VegaMovies */}
          {curatedVega.length > 0 && (
            <ContentRow
              title="Latest from VegaMovies"
              items={curatedVega}
              isLoading={isCuratedLoading}
              size="md"
              hoverCharacterMode="contained"
              enableHoverPortal={false}
              disableRankFillHover={isPerformance}
              disableHoverLogo={isPerformance}
              disableHoverCharacter={isPerformance}
            />
          )}

          {/* Latest from RogMovies */}
          {curatedRog.length > 0 && (
            <ContentRow
              title="Latest from RogMovies"
              items={curatedRog}
              isLoading={isCuratedLoading}
              size="md"
              hoverCharacterMode="contained"
              enableHoverPortal={false}
              disableRankFillHover={isPerformance}
              disableHoverLogo={isPerformance}
              disableHoverCharacter={isPerformance}
            />
          )}

          {/* Curated TV Series */}
          {curatedSeries.length > 0 && (
            <ContentRow
              title="TV Series & Shows"
              items={curatedSeries}
              isLoading={isCuratedLoading}
              size="md"
              hoverCharacterMode="contained"
              enableHoverPortal={false}
              disableRankFillHover={isPerformance}
              disableHoverLogo={isPerformance}
              disableHoverCharacter={isPerformance}
            />
          )}

          {/* Curated Movies */}
          {curatedMovies.length > 0 && (
            <ContentRow
              title="Movies & Blockbusters"
              items={curatedMovies}
              isLoading={isCuratedLoading}
              size="md"
              hoverCharacterMode="contained"
              enableHoverPortal={false}
              disableRankFillHover={isPerformance}
              disableHoverLogo={isPerformance}
              disableHoverCharacter={isPerformance}
            />
          )}
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Index;
