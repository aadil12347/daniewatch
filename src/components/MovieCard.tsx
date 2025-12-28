import { Link } from "react-router-dom";
import { Star, Play } from "lucide-react";
import { Movie, getPosterUrl, getDisplayTitle, getReleaseDate, getYear } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

interface MovieCardProps {
  movie: Movie;
  index?: number;
  showRank?: boolean;
  size?: "sm" | "md" | "lg";
}

export const MovieCard = ({ movie, index, showRank = false, size = "md" }: MovieCardProps) => {
  const posterUrl = getPosterUrl(movie.poster_path, size === "sm" ? "w185" : "w342");
  const title = getDisplayTitle(movie);
  const year = getYear(getReleaseDate(movie));
  const rating = movie.vote_average?.toFixed(1);
  const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");

  const sizeClasses = {
    sm: "w-32 sm:w-36",
    md: "w-40 sm:w-48",
    lg: "w-48 sm:w-56",
  };

  const rankSizeClasses = showRank ? "ml-10 sm:ml-14" : "";

  return (
    <Link
      to={`/${mediaType}/${movie.id}`}
      className={cn("group relative flex-shrink-0", sizeClasses[size], rankSizeClasses)}
    >
      {/* Rank Number */}
      {showRank && index !== undefined && (
        <div className="relative flex items-end">
          <div className="absolute -left-10 sm:-left-14 bottom-2 z-20 pointer-events-none transition-all duration-300 group-hover:drop-shadow-[0_0_20px_hsl(var(--primary))]">
            <span
              className="text-[4rem] sm:text-[5rem] font-black leading-none transition-all duration-300"
              style={{
                WebkitTextStroke: "2px hsl(var(--primary))",
                WebkitTextFillColor: "hsl(var(--primary) / 0.3)",
              }}
            >
              {index + 1}
            </span>
          </div>
        </div>
      )}

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

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

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
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{year}</span>
          <span className="text-xs text-muted-foreground capitalize">• {mediaType}</span>
        </div>
      </div>
    </Link>
  );
};
