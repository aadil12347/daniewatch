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
import { useDbManifest } from "@/hooks/useDbManifest";

interface HeroSectionProps {
  items: Movie[];
  isLoading: boolean;
}

export const HeroSection = ({ items, isLoading }: HeroSectionProps) => {
  const navigate = useNavigate();
  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const { filterBlockedPosts } = usePostModeration();
  const { availabilityById } = useDbManifest();

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
        const manifestKey = `${item.id}-${mediaType}`;

        // 1. Check direct prop
        if ((item as any).logo_url) {
          return { id: item.id, logoUrl: (item as any).logo_url };
        }

        // 2. Check manifest using composite key
        const manifestData = availabilityById.get(manifestKey);
        if (manifestData?.logoUrl) {
          return { id: item.id, logoUrl: manifestData.logoUrl };
        }

        // 3. TMDB fallback
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
  }, [featured, availabilityById]);

  useEffect(() => {
    if (featured.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featured.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featured.length]);

  // Keep index in range whenever featured changes or after loading completes
  useEffect(() => {
    if (isLoading) return;
    if (featured.length === 0) return;
    if (currentIndex >= featured.length) setCurrentIndex(0);
  }, [currentIndex, featured.length, isLoading]);

  // Derive current hero (may be undefined while loading)
  const current = featured[currentIndex];
  const backdropUrl = current ? getBackdropUrl(current.backdrop_path) : null;

  const setNavbarTintFromImageUrl = async (url: string | null) => {
    const root = document.documentElement;
    if (!url) {
      root.style.setProperty("--navbar-tint", "var(--primary)");
      root.style.setProperty("--navbar-tint-alpha", "0.14");
      return;
    }

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = url;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load hero image for tint"));
      });

      const canvas = document.createElement("canvas");
      const size = 32;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("No canvas context");

      // Downsample aggressively for speed.
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);

      // Average non-transparent pixels.
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 16) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
      if (!n) throw new Error("No pixels sampled");

      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);

      // Convert RGB -> HSL (0-360, 0-100, 0-100)
      const rf = r / 255;
      const gf = g / 255;
      const bf = b / 255;
      const max = Math.max(rf, gf, bf);
      const min = Math.min(rf, gf, bf);
      const d = max - min;
      let h = 0;
      const l = (max + min) / 2;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

      if (d !== 0) {
        switch (max) {
          case rf:
            h = ((gf - bf) / d) % 6;
            break;
          case gf:
            h = (bf - rf) / d + 2;
            break;
          default:
            h = (rf - gf) / d + 4;
        }
        h = Math.round(h * 60);
        if (h < 0) h += 360;
      }

      // Keep it subtle + readable.
      const hh = Math.round(h);
      const ss = Math.round(Math.min(62, Math.max(18, s * 100)));
      const ll = Math.round(Math.min(28, Math.max(10, l * 100)));

      root.style.setProperty("--navbar-tint", `${hh} ${ss}% ${ll}%`);
      root.style.setProperty("--navbar-tint-alpha", "0.14");
    } catch {
      const root = document.documentElement;
      root.style.setProperty("--navbar-tint", "var(--primary)");
      root.style.setProperty("--navbar-tint-alpha", "0.14");
    }
  };

  // Update navbar tint when the featured hero changes.
  useEffect(() => {
    setNavbarTintFromImageUrl(backdropUrl);
    return () => {
      const root = document.documentElement;
      root.style.setProperty("--navbar-tint", "var(--primary)");
      root.style.setProperty("--navbar-tint-alpha", "0.14");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backdropUrl]);

  if (isLoading) {
    return (
      <div className="relative h-[85vh] min-h-[600px]">
        <Skeleton className="absolute inset-0" />
      </div>
    );
  }

  // If the fetch failed / returned empty, avoid rendering a blank hero.
  if (featured.length === 0) {
    return (
      <div className="relative h-[85vh] min-h-[600px] overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <div className="relative container mx-auto h-full flex items-end pb-24 px-4">
          <div className="max-w-xl">
            <h1 className="text-3xl md:text-4xl font-bold">Nothing to show yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">We couldn’t load trending titles. Please reload.</p>
            <button
              type="button"
              className="mt-4 text-sm font-medium story-link"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const title = getDisplayTitle(current);
  const year = getYear(getReleaseDate(current));
  const mediaType = current.media_type || (current.first_air_date ? "tv" : "movie");
  const currentManifestKey = `${current.id}-${mediaType}`;
  const currentManifest = availabilityById.get(currentManifestKey);
  const ratingValue = currentManifest?.voteAverage ?? current.vote_average;
  const rating = ratingValue?.toFixed(1);
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
              <Star className="w-3.5 h-3.5 text-[hsl(var(--rating))] fill-[hsl(var(--rating))]" />
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
            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${idx === currentIndex
              ? "w-8 bg-primary"
              : "w-2 bg-foreground/30 hover:bg-foreground/50"
              }`}
          />
        ))}
      </div>
    </div>
  );
};
