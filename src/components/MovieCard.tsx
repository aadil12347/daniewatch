import { Link, useLocation } from "react-router-dom";
import { Star, Play, Bookmark, Ban } from "lucide-react";
import { Movie, getPosterUrl, getDisplayTitle, getReleaseDate, getYear } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useState, useEffect } from "react";
import { AdminPostControls } from "./AdminPostControls";
import { usePostModeration } from "@/hooks/usePostModeration";
import { useAdmin } from "@/hooks/useAdmin";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
interface MovieCardProps {
  movie: Movie;
  index?: number;
  showRank?: boolean;
  size?: "sm" | "md" | "lg";
  animationDelay?: number;
}

export const MovieCard = ({ movie, index, showRank = false, size = "md", animationDelay = 0 }: MovieCardProps) => {
  const location = useLocation();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { isAdmin } = useAdmin();
  const { isBlocked } = usePostModeration();
  const { getAvailability } = useEntryAvailability();
  const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
  const inWatchlist = isInWatchlist(movie.id, mediaType as 'movie' | 'tv');
  const posterUrl = getPosterUrl(movie.poster_path, size === "sm" ? "w185" : "w342");
  const title = getDisplayTitle(movie);
  const year = getYear(getReleaseDate(movie));
  const rating = movie.vote_average?.toFixed(1);
  
  const blocked = isBlocked(movie.id, mediaType as 'movie' | 'tv');
  const { hasWatch, hasDownload } = getAvailability(movie.id);
  
  const [optimisticInWatchlist, setOptimisticInWatchlist] = useState<boolean | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Use optimistic state if set, otherwise use actual state
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

  const rankSizeClasses = showRank ? "ml-10 sm:ml-14" : "";

  return (
    <div 
      className={cn("group relative flex-shrink-0 card-reveal", showRank && "pl-6 sm:pl-10")}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Rank Number - Default: behind poster, white outline, black fill */}
      {showRank && index !== undefined && (
        <div className="absolute left-0 bottom-12 transition-all duration-700 ease-out z-0 group-hover:z-20 group-hover:left-1 group-hover:bottom-16 group-hover:drop-shadow-[0_0_30px_hsl(var(--primary))] pointer-events-none">
          <span className="rank-number text-[5rem] sm:text-[6rem] font-black leading-none">
            {index + 1}
          </span>
        </div>
      )}

      <div className={cn("relative", sizeClasses[size])}>
        <Link
          to={`/${mediaType}/${movie.id}`}
          state={{ backgroundLocation: location }}
          className="block"
        >
          {/* Card */}
          <div className="cinema-card relative aspect-[2/3] rounded-xl overflow-hidden bg-card">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 ease-out will-change-transform group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <span className="text-muted-foreground text-sm">{title}</span>
              </div>
            )}

            {/* Overlay - vignette effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

            {/* Play Button */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-14 h-14 rounded-full gradient-red flex items-center justify-center shadow-glow transform scale-75 group-hover:scale-100 transition-transform duration-300">
                <Play className="w-6 h-6 text-foreground fill-current ml-1" />
              </div>
            </div>

            {/* Rating Badge */}
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md glass text-xs font-medium">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              {rating}
            </div>
            
            {/* Admin indicator for blocked */}
            {isAdmin && blocked && (
              <div className="absolute top-2 left-2 flex items-center gap-1">
                <div className="p-1 rounded-md bg-destructive/80 backdrop-blur-sm" title="Blocked">
                  <Ban className="w-3 h-3 text-destructive-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-3 px-1">
            <h3 className="title-glow-underline font-medium text-sm truncate max-w-full">
              {title}
            </h3>
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
                displayedInWatchlist
                  ? "text-primary fill-primary scale-110" 
                  : "text-foreground fill-transparent scale-100"
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
          <AdminPostControls
            tmdbId={movie.id}
            mediaType={mediaType as 'movie' | 'tv'}
            title={title}
            posterPath={movie.poster_path}
          />
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
