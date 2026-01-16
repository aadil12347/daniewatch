import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
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
  sortByReleaseAirDateDesc,
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
  const { filterBlockedPosts, getPinnedPosts } = usePostModeration();

  const applyPinnedAndDateSort = (
    items: Movie[],
    page: string,
    defaultMediaType?: "movie" | "tv",
  ) => {
    const filtered = filterBlockedPosts(items, defaultMediaType);
    const pinnedForPage = getPinnedPosts(page);

    if (pinnedForPage.length === 0) return sortByReleaseAirDateDesc(filtered);

    const pinnedItems: Movie[] = [];
    const nonPinned: Movie[] = [];

    filtered.forEach((item) => {
      const mediaType = (item.media_type ||
        (item.first_air_date ? "tv" : defaultMediaType || "movie")) as
        | "movie"
        | "tv";

      const isPinnedItem = pinnedForPage.some(
        (p) => p.tmdb_id === String(item.id) && p.media_type === mediaType,
      );

      (isPinnedItem ? pinnedItems : nonPinned).push(item);
    });

    return [...pinnedItems, ...sortByReleaseAirDateDesc(nonPinned)];
  };

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
        <HeroSection items={sortByReleaseAirDateDesc(trending)} isLoading={isLoading} />

        <div className="relative z-10 -mt-16">
          <ContentRow
            title="Top 10 Today"
            items={applyPinnedAndDateSort(sortByReleaseAirDateDesc(trending), "home").slice(0, 10)}
            isLoading={isLoading}
            showRank
            size="lg"
          />

          <TabbedContentRow
            title="Trending Now"
            moviesItems={applyPinnedAndDateSort(
              sortByReleaseAirDateDesc(trending).filter(
                (item) => item.media_type === "movie",
              ),
              "home",
              "movie",
            )}
            tvItems={applyPinnedAndDateSort(
              sortByReleaseAirDateDesc(trending).filter(
                (item) => item.media_type === "tv",
              ),
              "home",
              "tv",
            )}
            isLoading={isLoading}
          />

          <TabbedContentRow
            title="Popular"
            moviesItems={applyPinnedAndDateSort(popularMovies, "home", "movie")}
            tvItems={applyPinnedAndDateSort(popularTV, "home", "tv")}
            isLoading={isLoading}
          />

          {/* Regional Popular Sections */}
          <TabbedContentRow
            title="Indian Popular"
            moviesItems={applyPinnedAndDateSort(
              indianPopular.filter((item) => item.media_type === "movie"),
              "home",
              "movie",
            )}
            tvItems={applyPinnedAndDateSort(
              indianPopular.filter((item) => item.media_type === "tv"),
              "home",
              "tv",
            )}
            isLoading={isLoading}
          />

          <TabbedContentRow
            title="Anime Popular"
            moviesItems={applyPinnedAndDateSort(
              animePopular.filter((item) => item.media_type === "movie"),
              "home",
              "movie",
            )}
            tvItems={applyPinnedAndDateSort(
              animePopular.filter((item) => item.media_type === "tv"),
              "home",
              "tv",
            )}
            isLoading={isLoading}
            defaultTab="tv"
          />

          <TabbedContentRow
            title="Korean Popular"
            moviesItems={applyPinnedAndDateSort(
              koreanPopular.filter((item) => item.media_type === "movie"),
              "home",
              "movie",
            )}
            tvItems={applyPinnedAndDateSort(
              koreanPopular.filter((item) => item.media_type === "tv"),
              "home",
              "tv",
            )}
            isLoading={isLoading}
            defaultTab="tv"
          />

          <TabbedContentRow
            title="Top Rated"
            moviesItems={applyPinnedAndDateSort(topRatedMovies, "home", "movie")}
            tvItems={applyPinnedAndDateSort(topRatedTV, "home", "tv")}
            isLoading={isLoading}
          />
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Index;