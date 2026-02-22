import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { Bookmark, Download, Star, Clock, Calendar, ArrowLeft, Loader2, Ban, Pin, ExternalLink } from "lucide-react";

import { Footer } from "@/components/Footer";
import { ActorCard } from "@/components/ActorCard";
import { MovieCard } from "@/components/MovieCard";
import { BackgroundTrailer } from "@/components/BackgroundTrailer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { AdminPostControls } from "@/components/AdminPostControls";
import { AnimatedPlayButton } from "@/components/AnimatedPlayButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMediaLinks, MediaLinkResult } from "@/lib/mediaLinks";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAuth } from "@/contexts/AuthContext";
import { useMedia } from "@/contexts/MediaContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useEntries } from "@/hooks/useEntries";
import { usePostModeration } from "@/hooks/usePostModeration";
import {
  getMovieDetails,
  getMovieCredits,
  getSimilarMovies,
  getMovieImages,
  filterAdultContentStrict,
  MovieDetails as MovieDetailsType,
  Cast,
  Movie,
  getBackdropUrl,
  getImageUrl,
  formatRuntime,
  getYear,
} from "@/lib/tmdb";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { haptic } from "@/lib/haptics";
import { useContentAccess } from "@/hooks/useContentAccess";

type MovieDetailsProps = {
  modal?: boolean;
};

const MovieDetails = ({ modal = false }: MovieDetailsProps) => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<MovieDetailsType | null>(null);
  const [cast, setCast] = useState<Cast[]>([]);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imdbId, setImdbId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Watchlist optimistic UI + micro-animations
  const [optimisticInWatchlist, setOptimisticInWatchlist] = useState<boolean | null>(null);
  const [watchlistAnim, setWatchlistAnim] = useState<"add" | "remove" | null>(null);
  const [isBookmarking, setIsBookmarking] = useState(false);

  // Media links (DB -> fallback)
  const [mediaResult, setMediaResult] = useState<MediaLinkResult | null>(null);

  // Player reveal origin (for the splash animation)
  const [revealOrigin, setRevealOrigin] = useState<{ x: number; y: number } | null>(null);

  useRouteContentReady(!isLoading);

  const heroRef = useRef<HTMLDivElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);

  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { user } = useAuth();
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const { isLoading: isModerationLoading, isBlocked, isPinned, filterBlockedPosts } = usePostModeration();
  const { setCurrentMedia, clearCurrentMedia } = useMedia();

  const [blockedForUser, setBlockedForUser] = useState(false);

  // URL-driven player state
  const isPlayerOpen = useMemo(() => {
    return new URLSearchParams(location.search).get("watch") === "1";
  }, [location.search]);

  // Check for autoPlay state from continue watching navigation
  const autoPlayState = useMemo(() => {
    const state = location.state as { autoPlay?: boolean; season?: number; episode?: number } | null;
    return state?.autoPlay ? state : null;
  }, [location.state]);

  // Auto-open player when navigating from continue watching
  useEffect(() => {
    if (autoPlayState && movie && !isPlayerOpen) {
      // Navigate to open the player
      navigate(`?watch=1`, { replace: true, state: null });
    }
  }, [autoPlayState, movie, isPlayerOpen, navigate]);

  // Set media context when movie loads
  useEffect(() => {
    if (!movie) return;
    setCurrentMedia({ title: movie.title, type: 'movie', tmdbId: movie.id });
    return () => {
      clearCurrentMedia();
    };
  }, [movie, setCurrentMedia, clearCurrentMedia]);

  const displayedInWatchlist =
    optimisticInWatchlist !== null ? optimisticInWatchlist : isInWatchlist(movie?.id ?? 0, "movie");

  // Sync optimistic state when actual state catches up
  useEffect(() => {
    if (movie && optimisticInWatchlist !== null && optimisticInWatchlist === isInWatchlist(movie.id, "movie")) {
      setOptimisticInWatchlist(null);
    }
  }, [movie?.id, optimisticInWatchlist, isInWatchlist]);

  const { isAccessible, isLoading: isAccessLoading } = useContentAccess();

  useEffect(() => {
    if (!id) return;
    if (isAdminLoading || isModerationLoading || isAccessLoading) return;

    const blocked = isBlocked(Number(id), 'movie');
    const notInManifest = !isAccessible(Number(id), 'movie');

    if ((blocked && !isAdmin) || notInManifest) {
      setBlockedForUser(true);
      setMovie(null);
      setCast([]);
      setSimilar([]);
      setLogoUrl(null);
      setMediaResult(null);
      setIsLoading(false);
    } else {
      setBlockedForUser(false);
    }
  }, [id, isAdminLoading, isModerationLoading, isBlocked, isAdmin, isAccessible, isAccessLoading]);

  const { fetchEntry } = useEntries();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      if (blockedForUser) return;
      setIsLoading(true);

      try {
        const [movieRes, creditsRes, similarRes, imagesRes, dbEntry] = await Promise.all([
          getMovieDetails(Number(id)),
          getMovieCredits(Number(id)),
          getSimilarMovies(Number(id)),
          getMovieImages(Number(id)),
          fetchEntry(id),
        ]);

        // Determine if DB entry has active links
        const hasActiveLinks = dbEntry?.content && (
          (dbEntry.type === "movie" && (
            (dbEntry.content as { watch_link?: string }).watch_link?.trim() ||
            (dbEntry.content as { download_link?: string }).download_link?.trim()
          )) ||
          (dbEntry.type === "series" && Object.values(dbEntry.content).some(
            (s: any) => s.watch_links?.some((l: string) => l?.trim()) || s.download_links?.some((l: string) => l?.trim())
          ))
        );

        // Merge DB data with TMDB data, prioritizing DB fields ONLY if entry has active links
        const mergedMovie: MovieDetailsType = {
          ...movieRes,
          title: (hasActiveLinks && dbEntry?.title) || movieRes.title,
          overview: (hasActiveLinks && dbEntry?.overview) || movieRes.overview,
          poster_path: (hasActiveLinks && dbEntry?.poster_url) || movieRes.poster_path,
          backdrop_path: (hasActiveLinks && dbEntry?.backdrop_url) || movieRes.backdrop_path,
          vote_average: (hasActiveLinks && dbEntry?.vote_average) || movieRes.vote_average,
          tagline: (hasActiveLinks && dbEntry?.tagline) || movieRes.tagline,
          runtime: (hasActiveLinks && dbEntry?.runtime) || movieRes.runtime,
        };

        if (hasActiveLinks && dbEntry?.genres) {
          mergedMovie.genres = dbEntry.genres;
        }

        // Set IMDb ID from DB entry
        if (dbEntry?.imdb_id) {
          setImdbId(dbEntry.imdb_id);
        }

        setMovie(mergedMovie);
        setCast(creditsRes.cast.slice(0, 12));

        // Filter similar movies with strict certification check
        const filteredSimilar = (await filterAdultContentStrict(
          similarRes.results.map((m) => ({ ...m, media_type: "movie" as const })),
          "movie"
        )) as Movie[];
        setSimilar(filteredSimilar.slice(0, 14));

        // Priority for Logo: DB (if has links) -> TMDB
        const dbLogo = hasActiveLinks ? dbEntry?.logo_url : null;
        if (dbLogo) {
          setLogoUrl(dbLogo);
        } else {
          const logo = imagesRes.logos?.find((l) => l.iso_639_1 === 'en') || imagesRes.logos?.[0];
          if (logo) {
            setLogoUrl(getImageUrl(logo.file_path, "w500"));
          }
        }

        // Check for media links (Supabase -> Blogger -> fallback)
        const mediaRes = await getMediaLinks(Number(id), "movie");
        setMediaResult(mediaRes);
      } catch (error) {
        console.error("Failed to fetch movie details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    if (!modal) window.scrollTo(0, 0);
  }, [id, blockedForUser, modal, fetchEntry]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Backdrop / trailer area skeleton */}
        <div className="relative h-[70vh] md:h-[calc(100vh-var(--app-header-offset))] md:min-h-[640px]">
          <Skeleton className="absolute inset-0" />
          {/* Gradient overlays to match real page */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Content skeleton — matches the real details overlay layout */}
        <div className="container mx-auto px-4 md:px-0 relative z-10 -mt-44 md:details-overlap-desktop">
          <div className="max-w-xl lg:max-w-2xl md:px-8 lg:px-12">
            {/* Logo placeholder */}
            <Skeleton className="h-16 md:h-20 w-48 md:w-64 mb-3 md:mb-4 rounded-lg" />

            {/* Meta info chips */}
            <div className="flex items-center gap-2 mb-2 md:mb-4">
              <Skeleton className="h-6 w-14 rounded" />
              <Skeleton className="h-4 w-10 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>

            {/* Genre tags */}
            <div className="flex gap-2 mb-2 md:mb-4">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>

            {/* Overview text lines (hidden on mobile like real page) */}
            <div className="hidden md:block space-y-2 mb-5">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>

            {/* Action buttons — real shapes */}
            <div className="flex items-center gap-3">
              <div className="h-11 md:h-10 px-6 md:px-8 rounded-full bg-primary/20 flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary/30" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
              <div className="h-10 w-10 rounded-full bg-secondary/40" />
              <div className="h-10 w-10 rounded-full bg-secondary/40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    if (blockedForUser) {
      return (
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 pt-32 text-center">
            <h1 className="text-2xl font-bold mb-2">Not available</h1>
            <p className="text-muted-foreground mb-6">This content has been blocked by the administrator.</p>
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-32 text-center">
          <h1 className="text-2xl font-bold mb-4">Movie not found</h1>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const backdropUrl = getBackdropUrl(movie.backdrop_path);
  const trailer = movie.videos?.results.find(
    (v) => v.type === "Trailer" && v.site === "YouTube"
  );
  const trailerKey = trailer?.key || null;

  return (
    <>
      <Helmet>
        <title>{movie.title} - DanieWatch</title>
        <meta name="description" content={movie.overview?.slice(0, 160)} />
      </Helmet>

      <div className="min-h-screen bg-background">



        {/* Hero Section - Full viewport height on desktop, shorter on mobile */}
        <div className="relative">
          <div
            ref={heroRef}
            className="relative h-[70vh] md:h-[calc(100vh-var(--app-header-offset))] md:min-h-[640px]"
          >
            {/* Background Trailer (hide when playing) */}
            {!isPlayerOpen ? (
              <BackgroundTrailer
                videoKey={trailerKey}
                backdropUrl={backdropUrl}
                title={movie.title}
                controlsPlacement={modal ? "modal" : "page"}
              />
            ) : (
              <VideoPlayer
                tmdbId={Number(id)}
                type="movie"
                onClose={() => navigate(-1)}
                inline
                fill
                controlsPlacement={modal ? "modal" : "page"}
                className=""
                title={movie.title}
                posterPath={movie.poster_path}
                style={{
                  ["--reveal-x" as any]: revealOrigin ? `${revealOrigin.x}px` : "18%",
                  ["--reveal-y" as any]: revealOrigin ? `${revealOrigin.y}px` : "85%",
                }}
              />
            )}

            {/* Readability overlays (disabled while playing so iframe controls stay clear) */}
            {!isPlayerOpen && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent pointer-events-none" />
              </>
            )}
          </div>

          {/* Details block (animates below player; overlays trailer when not playing) */}
          <div
            className={
              "container mx-auto px-4 md:px-0 relative z-10 transform-gpu will-change-transform " +
              (modal ? "" : "") +
              // IMPORTANT: avoid translateY when player is open (transforms don't take layout space and can overlap the Actors section)
              (isPlayerOpen ? "mt-6 md:mt-10" : "-mt-44 md:details-overlap-desktop")
            }
          >
            <div
              className={
                (modal ? "" : "") +
                "max-w-xl lg:max-w-2xl md:px-8 lg:px-12 " +
                (isPlayerOpen
                  ? "rounded-2xl bg-card/80 backdrop-blur-xl border border-border p-4 md:p-0 md:bg-transparent md:border-0 md:backdrop-blur-none"
                  : "")
              }
            >
              {/* Logo */}
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={movie.title}
                  className="h-16 md:h-20 lg:h-24 object-contain object-left mb-3 md:mb-4"
                />
              ) : (
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4 leading-tight">
                  {movie.title}
                </h1>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-2 md:mb-4">
                <div className="flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded bg-background/50 backdrop-blur-sm">
                  <Star className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold text-[10px] md:text-sm">{movie.vote_average?.toFixed(1)}</span>
                </div>
                <span className="text-muted-foreground text-[10px] md:text-sm">{getYear(movie.release_date)}</span>
                {movie.runtime && (
                  <>
                    <span className="text-muted-foreground text-[10px] md:text-sm">•</span>
                    <span className="text-muted-foreground text-[10px] md:text-sm">{formatRuntime(movie.runtime)}</span>
                  </>
                )}
                {imdbId && (
                  <>
                    <span className="text-muted-foreground text-[10px] md:text-sm">•</span>
                    <a
                      href={`https://www.imdb.com/title/${imdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] md:text-sm text-yellow-500 hover:text-yellow-400 transition-colors"
                    >
                      <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      <span className="font-medium">IMDb</span>
                    </a>
                  </>
                )}
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-1 md:gap-2 mb-2 md:mb-4">
                {movie.genres?.slice(0, 3).map((genre) => (
                  <span
                    key={genre.id}
                    className="px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full bg-secondary/60 backdrop-blur-sm text-[10px] md:text-xs font-medium"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              {/* Overview - hidden on mobile to save space */}
              <p className="hidden md:block text-muted-foreground text-sm md:text-base mb-5 line-clamp-3">
                {movie.overview}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-3 md:gap-3">
                <AnimatedPlayButton
                  ref={playButtonRef}
                  className="h-11 md:h-10 px-6 md:px-8 shadow-glow"
                  onClick={() => {
                    // Compute splash origin BEFORE any scroll so it starts exactly at the Play button.
                    const heroRect = heroRef.current?.getBoundingClientRect();
                    const btnRect = playButtonRef.current?.getBoundingClientRect();
                    if (heroRect && btnRect) {
                      setRevealOrigin({
                        x: btnRect.left + btnRect.width / 2 - heroRect.left,
                        y: btnRect.top + btnRect.height / 2 - heroRect.top,
                      });
                    } else {
                      setRevealOrigin(null);
                    }

                    // Instant scroll (override global scroll-behavior: smooth)
                    const root = document.documentElement;
                    const prev = root.style.scrollBehavior;
                    root.style.scrollBehavior = "auto";
                    window.scrollTo({ top: 0, left: 0 });
                    requestAnimationFrame(() => {
                      root.style.scrollBehavior = prev;
                    });

                    // Add watch param to URL - this creates a history entry
                    const params = new URLSearchParams(location.search);
                    params.set("watch", "1");
                    navigate({ search: params.toString() });
                  }}
                />
                <button
                  type="button"
                  className={
                    "relative flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-full bg-secondary/50 border border-border backdrop-blur-sm transition-all duration-150 hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (displayedInWatchlist ? "text-primary border-primary bg-primary/20 " : "text-foreground ") +
                    (watchlistAnim === "add" ? "bookmark-burst " : "") +
                    (watchlistAnim === "remove" ? "bookmark-unburst " : "")
                  }
                  onClick={async () => {
                    if (!movie || isBookmarking) return;

                    const next = !displayedInWatchlist;
                    setOptimisticInWatchlist(next);

                    setWatchlistAnim(next ? "add" : "remove");
                    window.setTimeout(() => setWatchlistAnim(null), 400);

                    setIsBookmarking(true);
                    const movieData: Movie = {
                      id: movie.id,
                      title: movie.title,
                      overview: movie.overview,
                      poster_path: movie.poster_path,
                      backdrop_path: movie.backdrop_path,
                      vote_average: movie.vote_average,
                      release_date: movie.release_date,
                      genre_ids: movie.genres?.map((g) => g.id) || [],
                      media_type: "movie",
                    };
                    await toggleWatchlist(movieData);
                    setIsBookmarking(false);
                  }}
                  aria-label={displayedInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                  title={displayedInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                >
                  {isBookmarking ? (
                    <Loader2 className="w-5 h-5 md:w-4 md:h-4 animate-spin" />
                  ) : (
                    <Bookmark
                      className={
                        "w-5 h-5 md:w-4 md:h-4 transition-all duration-150 " +
                        (watchlistAnim === "add" ? "bookmark-pop " : "") +
                        (watchlistAnim === "remove" ? "bookmark-unpop " : "") +
                        (displayedInWatchlist
                          ? "fill-primary scale-110"
                          : "fill-transparent scale-100")
                      }
                    />
                  )}
                </button>
                {mediaResult?.downloadUrl && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-11 h-11 md:w-10 md:h-10 rounded-md md:rounded-lg bg-secondary/50 border-2 border-primary/80 text-primary backdrop-blur-sm transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                    onClick={() => {
                      haptic("tap");
                      window.open(mediaResult.downloadUrl, "_blank");
                    }}
                  >
                    <Download className="w-5 h-5 md:w-4 md:h-4" />
                  </Button>
                )}

                {/* Admin Controls */}
                {isAdmin && movie && (
                  <AdminPostControls
                    tmdbId={movie.id}
                    mediaType="movie"
                    title={movie.title}
                    posterPath={movie.poster_path}
                    className="ml-2"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cast Section - closer to hero on mobile */}
        {cast.length > 0 && (
          <section className="py-3 md:py-10 mt-6 md:mt-0">
            <div className="container mx-auto px-4 md:px-4">
              <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-6">Actors</h2>
              <div className="flex gap-3 md:gap-6 overflow-x-auto hide-scrollbar pb-2 md:pb-4">
                {cast.map((actor) => (
                  <ActorCard key={actor.id} actor={actor} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Similar Movies */}
        {similar.length > 0 && (
          <section className="py-3 md:py-10">
            <div className="container mx-auto px-4 md:px-4">
              <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-6">You may like</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-4 justify-items-center">
                {similar.map((item) => (
                  <MovieCard
                    key={item.id}
                    movie={{ ...item, media_type: "movie" }}
                    size="sm"
                    enableReveal={false}
                    enableHoverPortal={false}
                    hoverCharacterMode="contained"
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <Footer />
      </div>
    </>
  );
};

export default MovieDetails;
