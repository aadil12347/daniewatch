import { useEffect, useMemo, useState } from "react";
import { TabbedContentRow } from "@/components/TabbedContentRow";
import {
  getLatestReleasedMixed,
  getPopularMixed,
  getTopRatedMixed,
  Movie,
} from "@/lib/tmdb";

export type RailsMode = "global" | "indian" | "anime" | "korean";

export function StandardRails({
  mode,
  titlePrefix,
}: {
  mode: RailsMode;
  titlePrefix?: string;
}) {
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [popularTV, setPopularTV] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [topRatedTV, setTopRatedTV] = useState<Movie[]>([]);
  const [latestMovies, setLatestMovies] = useState<Movie[]>([]);
  const [latestTV, setLatestTV] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const prefix = useMemo(() => (titlePrefix ? `${titlePrefix} ` : ""), [titlePrefix]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setIsLoading(true);
        const [popular, topRated, latest] = await Promise.all([
          getPopularMixed(mode),
          getTopRatedMixed(mode),
          getLatestReleasedMixed(mode),
        ]);

        if (!isMounted) return;

        setPopularMovies(popular.movies);
        setPopularTV(popular.tv);
        setTopRatedMovies(topRated.movies);
        setTopRatedTV(topRated.tv);
        setLatestMovies(latest.movies);
        setLatestTV(latest.tv);
      } catch (e) {
        console.error("Failed to load rails", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [mode]);

  return (
    <>
      <TabbedContentRow
        title={`${prefix}Popular`}
        moviesItems={popularMovies}
        tvItems={popularTV}
        isLoading={isLoading}
      />
      <TabbedContentRow
        title={`${prefix}Top Rated`}
        moviesItems={topRatedMovies}
        tvItems={topRatedTV}
        isLoading={isLoading}
      />
      <TabbedContentRow
        title={`${prefix}Latest Released`}
        moviesItems={latestMovies}
        tvItems={latestTV}
        isLoading={isLoading}
      />
    </>
  );
}
