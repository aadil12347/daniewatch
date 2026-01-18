import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Star, Bookmark, Loader2 } from "lucide-react";
import {
  Movie,
  getBackdropUrl,
  getDisplayTitle,
  getReleaseDate,
  getYear,
  getMovieGenres,
  getTVGenres,
  getMovieImages,
  getTVImages,
  getImageUrl,
} from "@/lib/tmdb";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedPlayButton } from "@/components/AnimatedPlayButton";
import { useWatchlist } from "@/hooks/useWatchlist";
import { usePostModeration } from "@/hooks/usePostModeration";

interface HeroSectionProps {
  items: Movie[];
  isLoading: boolean;
}

export const HeroSection = ({ items, isLoading }: HeroSectionProps) => {
  const navigate = useNavigate();
  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const { filterBlockedPosts } = usePostModeration();

  const featured = useMemo(() => filterBlockedPosts(items).slice(0, 5), [filterBlockedPosts, items]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [genres, setGenres] = useState<Record<number, string>>({});
  const [logos, setLogos] = useState<Record<number, string | null>>({});

  const [watchlistAnim, setWatchlistAnim] = useState<"add" | "remove" | null>(null);
  const [isBookmarking, setIsBookmarking] = useState(false);

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

  // Fetch logos for featured items
  useEffect(() => {
    const fetchLogos = async () => {
      const logoPromises = featured.map(async (item) => {
        const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");
        try {
          const images = mediaType === "tv" ? await getTVImages(item.id) : await getMovieImages(item.id);
          const logo = images.logos?.find((l) => l.iso_639_1 === "en") || images.logos?.[0];
          return { id: item.id, logoUrl: logo ? getImageUrl(logo.file_path, "w500") : null };
        } catch {
          return { id: item.id, logoUrl: null };
        }
      });

      const results = await Promise.all(logoPromises);
      const logoMap: Record<number, string | null> = {};
      results.forEach((r) => {
        logoMap[r.id] = r.logoUrl;
      });
      setLogos(logoMap);
    };

    if (featured.length > 0) {
      fetchLogos();
    }
  }, [featured]);

  useEffect(() => {
    if (featured.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featured.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featured.length]);

  if (isLoading) {
    return (
      <div className="relative h-[85vh] min-h-[600px]">
        <Skeleton className="absolute inset-0" />
      </div>
    );
  }

  useEffect(() => {
    if (currentIndex >= featured.length) setCurrentIndex(0);
  }, [currentIndex, featured.length]);

  const current = featured[currentIndex];

  if (!current) return null;

  const backdropUrl = getBackdropUrl(current.backdrop_path);
  const title = getDisplayTitle(current);
  const year = getYear(getReleaseDate(current));
  const rating = current.vote_average?.toFixed(1);
  const mediaType = current.media_type || (current.first_air_date ? "tv" : "movie");
  const genreNames = current.genre_ids?.slice(0, 3).map((id) => genres[id]).filter(Boolean) || [];
  const currentLogo = logos[current.id];

  return (
    <div className="relative h-[85vh] min-h-[600px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        {backdropUrl && (
          <img
            key={current.id}
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover object-center animate-fade-in transform-gpu"
          />
        )}
        {/* Gradients */}
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 gradient-hero-bottom" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/20" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto h-full flex items-end pb-24 px-4">
        <div className="max-w-xl animate-slide-up transform-gpu">
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

          {/* Logo or Title */}
          {currentLogo ? (
            <img 
              src={currentLogo} 
              alt={title} 
              className="h-14 md:h-16 lg:h-20 object-contain object-left mb-2 md:mb-3"
            />
          ) : (
            <h1 className="text-4xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-3 leading-tight">
              {title}
            </h1>
          )}

          {/* Genres */}
          <div className="flex flex-wrap gap-1.5 mb-3 md:mb-4">
            {genreNames.map((genre) => (
              <span
                key={genre}
                className="px-2 py-0.5 rounded-full bg-secondary/50 text-xs md:text-xs"
              >
                {genre}
              </span>
            ))}
          </div>

          {/* Overview */}
          <p className="text-sm md:text-sm text-muted-foreground mb-4 md:mb-5 line-clamp-2 max-w-lg">
            {current.overview}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <AnimatedPlayButton
              className="h-11 md:h-10 px-6 md:px-8 shadow-glow"
              label="Play"
              onClick={() => {
                const params = new URLSearchParams();
                params.set("watch", "1");
                if (mediaType === "tv") {
                  params.set("s", "1");
                  params.set("e", "1");
                }
                navigate({ pathname: `/${mediaType}/${current.id}`, search: params.toString() });
              }}
            />

            <button
              type="button"
              className={
                "relative flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-full bg-secondary/50 border border-border backdrop-blur-sm transition-all duration-150 hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (isInWatchlist(current.id, mediaType as "movie" | "tv") ? "text-primary border-primary bg-primary/20 " : "text-foreground ") +
                (watchlistAnim === "add" ? "bookmark-burst " : "") +
                (watchlistAnim === "remove" ? "bookmark-unburst " : "")
              }
              onClick={async () => {
                if (isBookmarking) return;

                const next = !isInWatchlist(current.id, mediaType as "movie" | "tv");
                setWatchlistAnim(next ? "add" : "remove");
                window.setTimeout(() => setWatchlistAnim(null), 400);

                setIsBookmarking(true);
                await toggleWatchlist({ ...current, media_type: mediaType });
                setIsBookmarking(false);
              }}
              aria-label={
                isInWatchlist(current.id, mediaType as "movie" | "tv")
                  ? "Remove from watchlist"
                  : "Add to watchlist"
              }
              title={
                isInWatchlist(current.id, mediaType as "movie" | "tv")
                  ? "Remove from watchlist"
                  : "Add to watchlist"
              }
            >
              {isBookmarking ? (
                <Loader2 className="w-5 h-5 md:w-4 md:h-4 animate-spin" />
              ) : (
                <Bookmark
                  className={
                    "w-5 h-5 md:w-4 md:h-4 transition-all duration-150 " +
                    (watchlistAnim === "add" ? "bookmark-pop " : "") +
                    (watchlistAnim === "remove" ? "bookmark-unpop " : "") +
                    (isInWatchlist(current.id, mediaType as "movie" | "tv")
                      ? "fill-primary scale-110"
                      : "fill-transparent scale-100")
                  }
                />
              )}
            </button>

            {/* Keep link to details accessible via title click; optional direct nav */}
            <Link
              to={`/${mediaType}/${current.id}`}
              className="sr-only"
              aria-label="Open details"
            />
          </div>
        </div>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-14 md:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {featured.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
              idx === currentIndex
                ? "w-8 bg-primary"
                : "w-2 bg-foreground/30 hover:bg-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};
