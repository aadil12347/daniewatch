import { Link } from "react-router-dom";
import { Star, Bookmark, Ban, ShieldOff } from "lucide-react";
import { Movie, getPosterUrl, getDisplayTitle, getReleaseDate, getYear } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRef, useState, useEffect, type MouseEvent } from "react";
import { AdminPostControls } from "./AdminPostControls";
import { usePostModeration } from "@/hooks/usePostModeration";
import { useAdmin } from "@/hooks/useAdmin";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useTmdbLogo } from "@/hooks/useTmdbLogo";
import { useInViewport } from "@/hooks/useInViewport";

interface MovieCardProps {
  movie: Movie;
  index?: number;
  showRank?: boolean;
  size?: "sm" | "md" | "lg";
  animationDelay?: number;
}

export const MovieCard = ({ movie, index, showRank = false, size = "md", animationDelay = 0 }: MovieCardProps) => {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { isAdmin } = useAdmin();
  const { isBlocked, blockPost, unblockPost } = usePostModeration();
  const { getAvailability, getHoverImageUrl } = useEntryAvailability();
  const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
  const inWatchlist = isInWatchlist(movie.id, mediaType as "movie" | "tv");
  const posterUrl = getPosterUrl(movie.poster_path, size === "sm" ? "w185" : "w342");
  const title = getDisplayTitle(movie);
  const year = getYear(getReleaseDate(movie));
  const rating = movie.vote_average?.toFixed(1);

  const blocked = isBlocked(movie.id, mediaType as "movie" | "tv");
  const { hasWatch, hasDownload } = getAvailability(movie.id);
  const hoverImageUrl = getHoverImageUrl(movie.id);

  // Hard safety: never render blocked items to normal users.
  if (!isAdmin && blocked) return null;


  const [optimisticInWatchlist, setOptimisticInWatchlist] = useState<boolean | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPosterActive, setIsPosterActive] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const isNearViewport = useInViewport(cardRef);

  // Preload the hover logo as soon as the card is on/near screen.
  const { data: logoUrl } = useTmdbLogo(mediaType as "movie" | "tv", movie.id, isPosterActive || isNearViewport);
  const displayedInWatchlist = optimisticInWatchlist !== null ? optimisticInWatchlist : inWatchlist;

  // Sync optimistic state when actual state catches up
  useEffect(() => {
    if (optimisticInWatchlist !== null && optimisticInWatchlist === inWatchlist) {
      setOptimisticInWatchlist(null);
    }
  }, [inWatchlist, optimisticInWatchlist]);

  const sizeClasses = {
    sm: "w-32 sm:w-36",
    md: "w-40 sm:w-48",
    lg: "w-48 sm:w-56",
  };

  const handleBlockToggle = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isBlocking) return;

    setIsBlocking(true);
    try {
      if (blocked) {
        await unblockPost(movie.id, mediaType as "movie" | "tv");
      } else {
        await blockPost(movie.id, mediaType as "movie" | "tv", title, movie.poster_path);
      }
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={cn("group relative flex-shrink-0 card-reveal", showRank && "pl-6 sm:pl-10")}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Rank Number - Default: behind poster, white outline, black fill */}
      {showRank && index !== undefined && (
        <div className="absolute left-0 bottom-12 transition-all duration-700 ease-out z-0 group-hover:z-20 group-hover:left-1 group-hover:bottom-16 group-hover:drop-shadow-[0_0_30px_hsl(var(--primary))] pointer-events-none">
          <span className="rank-number text-[5rem] sm:text-[6rem] font-black leading-none">{index + 1}</span>
        </div>
      )}

      <div className={cn("relative", sizeClasses[size])}>
        <Link
          to={`/${mediaType}/${movie.id}`}
          className="block"
          onMouseEnter={() => setIsPosterActive(true)}
          onMouseLeave={() => setIsPosterActive(false)}
          onFocus={() => setIsPosterActive(true)}
          onBlur={() => setIsPosterActive(false)}
        >
          {/* Card */}
          <div className="cinema-card poster-3d-card relative aspect-[2/3] rounded-xl bg-card">
            {/* Clip only the poster layers so the character can pop OUT of the card */}
            <div className="poster-3d-clip absolute inset-0 rounded-xl overflow-hidden">
              {posterUrl ? (
                <div className="poster-3d-wrapper">
                  <img
                    src={posterUrl}
                    alt={title}
                    loading={isNearViewport ? "eager" : "lazy"}
                    className={cn(
                      "poster-3d-cover poster-3d-cover--base",
                      isAdmin && blocked && "keep-greyscale grayscale saturate-0 contrast-75 brightness-75 opacity-70"
                    )}
                  />

                  {/* Mild poster blur layer (kept subtle) */}
                  <img
                    src={posterUrl}
                    alt=""
                    aria-hidden="true"
                    loading={isNearViewport ? "eager" : "lazy"}
                    className={cn(
                      "poster-3d-cover poster-3d-cover--blur",
                      isAdmin && blocked && "grayscale saturate-0 contrast-75 brightness-75 opacity-70"
                    )}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <span className="text-muted-foreground text-sm">{title}</span>
                </div>
              )}
            </div>

            {/* Optional character layer (from DB) - sits OUTSIDE the clip so it can come out of the card */}
            {hoverImageUrl && (
              <img
                src={hoverImageUrl}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className={cn(
                  "poster-3d-character",
                  isAdmin && blocked && "grayscale saturate-0 contrast-75 brightness-75 opacity-70"
                )}
              />
            )}


            {/* Optional logo (TMDB) - TOP layer */}
            {logoUrl && (
              <img
                src={logoUrl}
                alt={`${title} logo`}
                loading="eager"
                className={cn(
                  "poster-3d-logo",
                  isAdmin && blocked && "grayscale saturate-0 contrast-75 brightness-75 opacity-70"
                )}
              />
            )}

            {/* Extra dull overlay for blocked (admin only) */}
            {isAdmin && blocked && (
              <div className={cn("absolute inset-0 pointer-events-none", "bg-background/20", "animate-fade-in")} />
            )}

            {/* Top-right: Rating (users) OR Block toggle (admin) */}
            {isAdmin ? (
              <button
                onClick={handleBlockToggle}
                disabled={isBlocking}
                className={cn(
                  "absolute top-2 right-2 z-30 p-2 rounded-lg glass transition-all duration-150",
                  "opacity-100 md:opacity-0 md:group-hover:opacity-100",
                  blocked
                    ? "bg-success/25 ring-1 ring-success/50"
                    : "bg-secondary/60 hover:bg-destructive/15 ring-1 ring-border"
                )}
                title={blocked ? "Unblock" : "Block"}
                aria-label={blocked ? "Unblock post" : "Block post"}
              >
                {blocked ? (
                  <ShieldOff className={cn("w-5 h-5", "text-success")} />
                ) : (
                  <Ban className={cn("w-5 h-5", "text-destructive")} />
                )}
              </button>
            ) : (
              <div className="absolute top-2 right-2 z-30 flex items-center gap-1 px-2 py-1 rounded-md glass text-xs font-medium transition-opacity duration-200 md:opacity-100 md:group-hover:opacity-0">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                {rating}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-3 px-1">
            <h3 className="title-glow-underline font-medium text-sm truncate max-w-full">{title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{year}</span>
              <span className="text-xs text-muted-foreground capitalize">• {mediaType}</span>
            </div>
          </div>
        </Link>


        {/* Save to Watchlist Button - positioned on poster, outside Link */}
        {!showRank && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const newState = !displayedInWatchlist;

              // Instantly update UI (optimistic)
              setOptimisticInWatchlist(newState);

              // Trigger animation immediately on save
              if (newState) {
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 400);
              }

              // Database update in background
              toggleWatchlist(movie);
            }}
            className={cn(
              "absolute bottom-[4.5rem] right-2 p-2 rounded-lg glass transition-all duration-150 z-20",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              displayedInWatchlist ? "bg-primary/40" : "hover:bg-primary/20",
              isAnimating && "bookmark-burst"
            )}
            title={displayedInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Bookmark
              className={cn(
                "w-5 h-5 transition-all duration-150",
                isAnimating && "bookmark-pop",
                displayedInWatchlist ? "text-primary fill-primary scale-110" : "text-foreground fill-transparent scale-100"
              )}
            />
          </button>
        )}

        {/* Admin Controls - Always rendered, visibility controlled by opacity/pointer-events */}
        <div
          className={cn(
            "absolute top-2 left-2 z-30 flex items-center gap-1 transition-opacity duration-0",
            isAdmin ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          <AdminPostControls tmdbId={movie.id} mediaType={mediaType as "movie" | "tv"} title={title} posterPath={movie.poster_path} />
          {/* Link Availability Indicators - Admin Only */}
          <div className="flex items-center gap-1.5 ml-1">
            {/* Watch Link Indicator (Green) */}
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                hasWatch
                  ? "bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,1),0_0_12px_4px_rgba(74,222,128,0.8),0_0_20px_6px_rgba(74,222,128,0.5)]"
                  : "bg-green-900/50"
              )}
              title={hasWatch ? "Watch link available" : "No watch link"}
            />
            {/* Download Link Indicator (Red) */}
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                hasDownload
                  ? "bg-red-400 shadow-[0_0_6px_2px_rgba(248,113,113,1),0_0_12px_4px_rgba(248,113,113,0.8),0_0_20px_6px_rgba(248,113,113,0.5)]"
                  : "bg-red-900/50"
              )}
              title={hasDownload ? "Download link available" : "No download link"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

