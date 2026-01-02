import { Link } from "react-router-dom";
import { Star, Play, Bookmark } from "lucide-react";
import { Movie, getPosterUrl, getDisplayTitle, getReleaseDate, getYear } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";

interface MovieCardProps {
  movie: Movie;
  index?: number;
  showRank?: boolean;
  size?: "sm" | "md" | "lg";
  animationDelay?: number;
}

export const MovieCard = ({ movie, index, showRank = false, size = "md", animationDelay = 0 }: MovieCardProps) => {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
  const inWatchlist = isInWatchlist(movie.id, mediaType as 'movie' | 'tv');
  const posterUrl = getPosterUrl(movie.poster_path, size === "sm" ? "w185" : "w342");
  const title = getDisplayTitle(movie);
  const year = getYear(getReleaseDate(movie));
  const rating = movie.vote_average?.toFixed(1);

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
        <Link to={`/${mediaType}/${movie.id}`} className="block">
          {/* Card */}
          <div className="cinema-card relative aspect-[2/3] rounded-xl overflow-hidden bg-card">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
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
              toggleWatchlist(movie);
            }}
            className={cn(
              "absolute bottom-[4.5rem] right-2 p-2 rounded-lg glass transition-all duration-300 z-20",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:scale-110",
              inWatchlist ? "bg-primary/40" : "hover:bg-primary/20"
            )}
            title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Bookmark 
              className={cn(
                "w-5 h-5 transition-all duration-100",
                inWatchlist 
                  ? "text-primary fill-primary scale-110" 
                  : "text-foreground fill-transparent scale-100"
              )}
            />
          </button>
        )}
      </div>
    </div>
  );
};
