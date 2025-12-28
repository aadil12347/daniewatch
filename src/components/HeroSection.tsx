import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Info, Star } from "lucide-react";
import { Movie, getBackdropUrl, getDisplayTitle, getReleaseDate, getYear, getMovieGenres, getTVGenres, Genre } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface HeroSectionProps {
  items: Movie[];
  isLoading: boolean;
}

export const HeroSection = ({ items, isLoading }: HeroSectionProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [genres, setGenres] = useState<Record<number, string>>({});

  useEffect(() => {
    const loadGenres = async () => {
      try {
        const [movieGenres, tvGenres] = await Promise.all([
          getMovieGenres(),
          getTVGenres(),
        ]);
        const genreMap: Record<number, string> = {};
        [...movieGenres.genres, ...tvGenres.genres].forEach((g) => {
          genreMap[g.id] = g.name;
        });
        setGenres(genreMap);
      } catch (error) {
        console.error("Failed to load genres:", error);
      }
    };
    loadGenres();
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % Math.min(items.length, 5));
    }, 8000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (isLoading) {
    return (
      <div className="relative h-[85vh] min-h-[600px]">
        <Skeleton className="absolute inset-0" />
      </div>
    );
  }

  const featured = items.slice(0, 5);
  const current = featured[currentIndex];

  if (!current) return null;

  const backdropUrl = getBackdropUrl(current.backdrop_path);
  const title = getDisplayTitle(current);
  const year = getYear(getReleaseDate(current));
  const rating = current.vote_average?.toFixed(1);
  const mediaType = current.media_type || (current.first_air_date ? "tv" : "movie");
  const genreNames = current.genre_ids?.slice(0, 3).map((id) => genres[id]).filter(Boolean) || [];

  return (
    <div className="relative h-[85vh] min-h-[600px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        {backdropUrl && (
          <img
            key={current.id}
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover object-center animate-fade-in"
          />
        )}
        {/* Gradients */}
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 gradient-hero-bottom" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/20" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto h-full flex items-center px-4">
        <div className="max-w-xl animate-slide-up">
          {/* Meta info */}
          <div className="flex items-center gap-3 mb-3">
            <span className="px-2 py-0.5 rounded text-xs font-medium uppercase glass">
              {mediaType === "tv" ? "TV Series" : "Movie"}
            </span>
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-medium">{rating}</span>
            </div>
            <span className="text-sm text-muted-foreground">{year}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 leading-tight">
            {title}
          </h1>

          {/* Genres */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {genreNames.map((genre) => (
              <span
                key={genre}
                className="px-2 py-0.5 rounded-full bg-secondary/50 text-xs"
              >
                {genre}
              </span>
            ))}
          </div>

          {/* Overview */}
          <p className="text-sm text-muted-foreground mb-5 line-clamp-2 max-w-lg">
            {current.overview}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              asChild
              size="sm"
              className="gradient-red text-foreground font-medium px-5 hover:opacity-90 transition-opacity shadow-glow"
            >
              <Link to={`/${mediaType}/${current.id}`}>
                <Play className="w-4 h-4 mr-1.5 fill-current" />
                Play Now
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="bg-secondary/50 border-border hover:bg-secondary/80"
            >
              <Link to={`/${mediaType}/${current.id}`}>
                <Info className="w-4 h-4 mr-1.5" />
                More Info
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {featured.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? "w-8 bg-primary"
                : "bg-foreground/30 hover:bg-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};
