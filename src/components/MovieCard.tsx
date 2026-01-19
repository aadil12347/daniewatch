import { Link, useLocation, useNavigate } from "react-router-dom";
import { Star, Bookmark, Ban, ShieldOff } from "lucide-react";
import { Movie, getPosterUrl, getDisplayTitle, getReleaseDate, getYear } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRef, useState, useEffect, type MouseEvent } from "react";
import { createPortal } from "react-dom";
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
  className?: string;
  /**
   * Enables the staggered reveal animation (card-reveal).
   * Turn this off on grid pages to prevent re-triggered flashes on rerenders.
   */
  enableReveal?: boolean;
  /**
   * Enables the hover portal (fixes carousel clipping on Home rows).
   * Disable on large grid pages (e.g. /tv) to reduce scroll/resize paint churn.
   */
  enableHoverPortal?: boolean;
}

export const MovieCard = ({
  movie,
  index,
  showRank = false,
  size = "md",
  animationDelay = 0,
  className,
  enableReveal = true,
  enableHoverPortal = true,
}: MovieCardProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const backgroundLocation = (location.state as any)?.backgroundLocation ?? location;

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

  // Hover portal (fixes carousel clipping on Home rows)
  const [canUseHoverPortal, setCanUseHoverPortal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [isPortalMounted, setIsPortalMounted] = useState(false);
  const [isPortalActive, setIsPortalActive] = useState(false);

  const portalEnabled = enableHoverPortal && canUseHoverPortal && Boolean(hoverImageUrl);

  const cardRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const hasInitialPortalRectRef = useRef(false);
  const isNearViewport = useInViewport(cardRef);

  // Preload hover character image as the card gets near the viewport (so hover feels instant while scrolling)
  useEffect(() => {
    if (!hoverImageUrl) return;
    if (!isNearViewport && !isHovered) return;

    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = hoverImageUrl;
  }, [hoverImageUrl, isNearViewport, isHovered]);

  // Preload the hover logo as soon as the card is on/near screen.
  const { data: logoUrl } = useTmdbLogo(mediaType as "movie" | "tv", movie.id, isPosterActive || isNearViewport);
  const displayedInWatchlist = optimisticInWatchlist !== null ? optimisticInWatchlist : inWatchlist;

  // Determine whether to use the portal.
  // We use it on both desktop and mobile because Home rows can clip overflow.
  // On touch devices, the portal is driven by focus/blur (tap) rather than hover.
  useEffect(() => {
    if (!enableHoverPortal) {
      setCanUseHoverPortal(false);
      return;
    }
    if (typeof window === "undefined") return;

    setCanUseHoverPortal(true);
  }, [enableHoverPortal]);

  // Keep portal positioned correctly while hovering (scroll/resize) without React re-renders.
  // Use translate3d instead of left/top changes to avoid layout thrash (prevents Home scroll glitch).
  useEffect(() => {
    if (!portalEnabled) return;
    if (!isHovered) return;

    let raf = 0;

    const update = () => {
      if (!posterRef.current) return;
      const rect = posterRef.current.getBoundingClientRect();

      if (!hasInitialPortalRectRef.current) {
        hasInitialPortalRectRef.current = true;
        setHoverRect(rect);
      }

      if (portalRef.current) {
        portalRef.current.style.transform = `translate3d(${Math.round(rect.left)}px, ${Math.round(rect.top)}px, 0)`;
        portalRef.current.style.width = `${Math.round(rect.width)}px`;
        portalRef.current.style.height = `${Math.round(rect.height)}px`;
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [isHovered, portalEnabled]);
  useEffect(() => {
    if (!enableHoverPortal) {
      setIsPortalMounted(false);
      setIsPortalActive(false);
      return;
    }

    if (!portalEnabled) {
      setIsPortalMounted(false);
      setIsPortalActive(false);
      return;
    }

    if (isHovered) {
      setIsPortalMounted(true);
      setIsPortalActive(false);
      const raf = requestAnimationFrame(() => setIsPortalActive(true));
      return () => cancelAnimationFrame(raf);
    }

    // Fade out before unmounting
    setIsPortalActive(false);
    const t = window.setTimeout(() => {
      setIsPortalMounted(false);
      setHoverRect(null);
      hasInitialPortalRectRef.current = false;
    }, 220);
    return () => window.clearTimeout(t);
  }, [enableHoverPortal, isHovered, portalEnabled]);

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

  const shouldLetBrowserHandleLink = (e: React.MouseEvent) => {
    // allow new-tab, copy link, etc.
    if (e.button !== 0) return true;
    if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return true;
    return false;
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative flex-shrink-0",
        enableReveal && "card-reveal",
        className,
        showRank && "pl-6 sm:pl-10"
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
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
          state={{ backgroundLocation }}
          className="block"
          onClick={(e) => {
            if (shouldLetBrowserHandleLink(e)) return;
            if (!posterRef.current) return;

            e.preventDefault();

            // Simple, reliable open: a quick "pop" on the poster, then navigate.
            // (No stretching overlay layer.)
            try {
              posterRef.current.animate(
                [
                  { transform: "translateZ(0) scale(1)", offset: 0 },
                  { transform: "translateZ(0) scale(1.04)", offset: 0.6 },
                  { transform: "translateZ(0) scale(1.02)", offset: 1 },
                ],
                { duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
              );
            } catch {
              // ignore
            }

            window.setTimeout(() => {
              navigate(`/${mediaType}/${movie.id}`, { state: { backgroundLocation } });
            }, 90);
          }}
          onMouseEnter={() => setIsPosterActive(true)}
          onMouseLeave={() => setIsPosterActive(false)}
          onFocus={() => setIsPosterActive(true)}
          onBlur={() => setIsPosterActive(false)}
        >
          {/* Card */}
          <div ref={posterRef} className="cinema-card poster-3d-card relative aspect-[2/3] rounded-xl bg-card">
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

            {/* Optional character layer (from DB)
                - inline version works on grid pages
                - portal version is used on hover to bypass carousel clipping */}
            {hoverImageUrl && !portalEnabled && (
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

            {/* Logo (TMDB) - TOP layer; if missing, show the title instead */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${title} logo`}
                loading="eager"
                className={cn(
                  "poster-3d-logo",
                  isAdmin && blocked && "grayscale saturate-0 contrast-75 brightness-75 opacity-70"
                )}
              />
            ) : (
              <div className={cn("poster-3d-title", isAdmin && blocked && "opacity-70")}>{title}</div>
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

          {portalEnabled && isPortalMounted && hoverRect &&
            createPortal(
              <div
                ref={portalRef}
                className={cn("poster-3d-hover-portal", isPortalActive && "is-active")}
                style={{
                  left: 0,
                  top: 0,
                  width: hoverRect.width,
                  height: hoverRect.height,
                  transform: `translate3d(${Math.round(hoverRect.left)}px, ${Math.round(hoverRect.top)}px, 0)`,
                }}
              >
                <img
                  src={hoverImageUrl!}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className={cn(
                    "poster-3d-character poster-3d-character--portal",
                    isAdmin && blocked && "grayscale saturate-0 contrast-75 brightness-75 opacity-70"
                  )}
                />
              </div>,
              document.body
            )}

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

