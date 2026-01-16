import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import { Footer } from "@/components/Footer";
import { StandardRails } from "@/components/browse/StandardRails";
import { YearGroupedInfinite } from "@/components/browse/YearGroupedInfinite";
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
  filterMinimal,
  blendResults,
  Movie,
  TMDBResponse,
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
  const { filterBlockedPosts, sortWithPinnedFirst } = usePostModeration();

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
          regionInMoviesRes,
          regionInTVRes,
        ] = await Promise.all([
          getTrending("day"),
          getPopularMovies(),
          getTopRatedMovies(),
          getPopularTV(),
          getTopRatedTV(),
          getIndianPopular(),
          getAnimePopular(),
          getKoreanPopular(),
          // Region-IN sources for blending (your rule)
          fetch(
            `https://api.themoviedb.org/3/discover/movie?${new URLSearchParams({
              api_key: "fc6d85b3839330e3458701b975195487",
              include_adult: "false",
              sort_by: "popularity.desc",
              region: "IN",
              "primary_release_date.lte": new Date().toISOString().split("T")[0],
            })}`
          ).then((r) => r.json() as Promise<TMDBResponse<Movie>>),
          fetch(
            `https://api.themoviedb.org/3/discover/tv?${new URLSearchParams({
              api_key: "fc6d85b3839330e3458701b975195487",
              include_adult: "false",
              sort_by: "popularity.desc",
              region: "IN",
              "first_air_date.lte": new Date().toISOString().split("T")[0],
            })}`
          ).then((r) => r.json() as Promise<TMDBResponse<Movie>>),
        ]);

        const trendingFiltered = filterAdultContent(trendingRes.results);

        const regionInMovies = filterMinimal(regionInMoviesRes.results).map((m) => ({ ...m, media_type: "movie" }));
        const regionInTV = filterMinimal(regionInTVRes.results).map((t) => ({ ...t, media_type: "tv" }));

        // Mix Region-IN heavily into global lists
        setTrending(
          filterAdultContent(
            blendResults(
              trendingFiltered,
              [...regionInMovies, ...regionInTV],
              Math.max(trendingFiltered.length, 40),
              0.6
            )
          )
        );

        setPopularMovies(filterMinimal(blendResults(filterAdultContent(popularMoviesRes.results), regionInMovies, 20, 0.6)));
        setTopRatedMovies(filterMinimal(blendResults(filterAdultContent(topRatedMoviesRes.results), regionInMovies, 20, 0.6)));
        setPopularTV(filterMinimal(blendResults(filterAdultContent(popularTVRes.results), regionInTV, 20, 0.6)));
        setTopRatedTV(filterMinimal(blendResults(filterAdultContent(topRatedTVRes.results), regionInTV, 20, 0.6)));

        setIndianPopular(filterAdultContent(indianRes.results));
        setAnimePopular(filterAdultContent(animeRes.results));
        setKoreanPopular(filterAdultContent(koreanRes.results));
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
          content="Discover and stream millions of movies and TV shows. Trending, top-rated, popular, and latest releases by year."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <HeroSection items={trending} isLoading={isLoading} />

        <div className="relative z-10 -mt-16">
          <ContentRow
            title="Top 10 Today"
            items={sortWithPinnedFirst(filterBlockedPosts(trending.slice(0, 10)), "home")}
            isLoading={isLoading}
            showRank
            size="lg"
          />

          <TabbedContentRow
            title="Trending Now"
            moviesItems={filterBlockedPosts(trending.filter((item) => item.media_type === "movie"), "movie")}
            tvItems={filterBlockedPosts(trending.filter((item) => item.media_type === "tv"), "tv")}
            isLoading={isLoading}
          />

          <TabbedContentRow
            title="Popular"
            moviesItems={filterBlockedPosts(popularMovies, "movie")}
            tvItems={filterBlockedPosts(popularTV, "tv")}
            isLoading={isLoading}
          />

          {/* Regional Popular Sections */}
          <TabbedContentRow
            title="Indian Popular"
            moviesItems={filterBlockedPosts(indianPopular.filter((item) => item.media_type === "movie"), "movie")}
            tvItems={filterBlockedPosts(indianPopular.filter((item) => item.media_type === "tv"), "tv")}
            isLoading={isLoading}
          />

          <TabbedContentRow
            title="Anime Popular"
            moviesItems={filterBlockedPosts(animePopular.filter((item) => item.media_type === "movie"), "movie")}
            tvItems={filterBlockedPosts(animePopular.filter((item) => item.media_type === "tv"), "tv")}
            isLoading={isLoading}
            defaultTab="tv"
          />

          <TabbedContentRow
            title="Korean Popular"
            moviesItems={filterBlockedPosts(koreanPopular.filter((item) => item.media_type === "movie"), "movie")}
            tvItems={filterBlockedPosts(koreanPopular.filter((item) => item.media_type === "tv"), "tv")}
            isLoading={isLoading}
            defaultTab="tv"
          />

          <TabbedContentRow
            title="Top Rated"
            moviesItems={filterBlockedPosts(topRatedMovies, "movie")}
            tvItems={filterBlockedPosts(topRatedTV, "tv")}
            isLoading={isLoading}
          />

          {/* Rails + Year sections on homepage */}
          <StandardRails mode="global" />

          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold mt-6 mb-2">Browse by Year (Movies)</h2>
            <YearGroupedInfinite mode="global" mediaScope="movie" selectedGenres={[]} selectedYear={null} maxYears={3} />

            <h2 className="text-2xl md:text-3xl font-bold mt-10 mb-2">Browse by Year (TV Shows)</h2>
            <YearGroupedInfinite mode="global" mediaScope="tv" selectedGenres={[]} selectedYear={null} maxYears={3} />
          </div>

          <StandardRails mode="global" titlePrefix="More" />
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Index;
