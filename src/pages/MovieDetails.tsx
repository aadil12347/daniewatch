import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Play, Bookmark, Download, Star, Clock, Calendar, ArrowLeft, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ActorCard } from "@/components/ActorCard";
import { MovieCard } from "@/components/MovieCard";
import { BackgroundTrailer } from "@/components/BackgroundTrailer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { searchBloggerForTmdbId, BloggerVideoResult } from "@/lib/blogger";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAuth } from "@/contexts/AuthContext";
import { useMedia } from "@/contexts/MediaContext";
import {
  getMovieDetails,
  getMovieCredits,
  getSimilarMovies,
  getMovieImages,
  MovieDetails as MovieDetailsType,
  Cast,
  Movie,
  getBackdropUrl,
  getImageUrl,
  formatRuntime,
  getYear,
} from "@/lib/tmdb";

const MovieDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<MovieDetailsType | null>(null);
  const [cast, setCast] = useState<Cast[]>([]);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
  const [bloggerResult, setBloggerResult] = useState<BloggerVideoResult | null>(null);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { user } = useAuth();
  const { setCurrentMedia, clearCurrentMedia } = useMedia();

  // Set media context when movie loads
  useEffect(() => {
    if (movie) {
      setCurrentMedia({
        title: movie.title,
        type: 'movie',
      });
    }
    return () => clearCurrentMedia();
  }, [movie?.id, movie?.title, setCurrentMedia, clearCurrentMedia]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      try {
        const [movieRes, creditsRes, similarRes, imagesRes] = await Promise.all([
          getMovieDetails(Number(id)),
          getMovieCredits(Number(id)),
          getSimilarMovies(Number(id)),
          getMovieImages(Number(id)),
        ]);

        setMovie(movieRes);
        setCast(creditsRes.cast.slice(0, 12));
        setSimilar(similarRes.results.slice(0, 14));
        
        // Get the first English logo or any available logo
        const logo = imagesRes.logos?.find(l => l.iso_639_1 === 'en') || imagesRes.logos?.[0];
        if (logo) {
          setLogoUrl(getImageUrl(logo.file_path, "w500"));
        }

        // Check Blogger for download link
        const bloggerRes = await searchBloggerForTmdbId(Number(id), "movie");
        setBloggerResult(bloggerRes);
      } catch (error) {
        console.error("Failed to fetch movie details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="h-screen relative">
          <Skeleton className="absolute inset-0" />
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
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
        <Navbar />

        {/* Hero Section - Full viewport height on desktop, shorter on mobile */}
        <div className="relative h-[70vh] md:h-screen md:min-h-[700px]">
          {/* Background Trailer */}
          <BackgroundTrailer 
            videoKey={trailerKey} 
            backdropUrl={backdropUrl} 
            title={movie.title} 
          />

          {/* Content - Bottom left positioned, adjusted for mobile */}
          <div className="absolute bottom-6 md:bottom-0 left-0 right-0 px-4 md:px-0 md:left-0 md:right-auto md:p-8 lg:p-12">
            <div className="animate-slide-up max-w-xl lg:max-w-2xl">
              {/* Logo */}
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={movie.title} 
                  className="h-12 md:h-20 lg:h-24 object-contain object-left mb-2 md:mb-4"
                />
              ) : (
                <h1 className="text-xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4 leading-tight">
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
              <div className="flex items-center gap-2 md:gap-3">
                <Button
                  size="sm"
                  className="gradient-red text-foreground font-semibold px-5 md:px-8 text-sm md:text-sm hover:opacity-90 transition-opacity shadow-glow h-9 md:h-10"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setShowPlayer(true);
                  }}
                >
                  <Play className="w-4 h-4 md:w-4 md:h-4 mr-2 md:mr-2 fill-current" />
                  Play
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className={`w-9 h-9 md:w-10 md:h-10 rounded-full bg-secondary/50 border-border hover:bg-secondary/80 backdrop-blur-sm ${
                    isInWatchlist(movie.id, 'movie') ? 'text-primary border-primary' : ''
                  }`}
                  onClick={async () => {
                    if (isBookmarking) return;
                    setIsBookmarking(true);
                    const movieData: Movie = {
                      id: movie.id,
                      title: movie.title,
                      overview: movie.overview,
                      poster_path: movie.poster_path,
                      backdrop_path: movie.backdrop_path,
                      vote_average: movie.vote_average,
                      release_date: movie.release_date,
                      genre_ids: movie.genres?.map(g => g.id) || [],
                      media_type: 'movie',
                    };
                    await toggleWatchlist(movieData);
                    setIsBookmarking(false);
                  }}
                  disabled={isBookmarking}
                >
                  {isBookmarking ? (
                    <Loader2 className="w-4 h-4 md:w-4 md:h-4 animate-spin" />
                  ) : (
                    <Bookmark className={`w-4 h-4 md:w-4 md:h-4 ${isInWatchlist(movie.id, 'movie') ? 'fill-current' : ''}`} />
                  )}
                </Button>
                {bloggerResult?.downloadLink && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-secondary/50 border-border hover:bg-secondary/80 backdrop-blur-sm"
                    onClick={() => {
                      window.open(bloggerResult.downloadLink, '_blank');
                    }}
                  >
                    <Download className="w-4 h-4 md:w-4 md:h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cast Section - closer to hero on mobile */}
        {cast.length > 0 && (
          <section className="py-3 md:py-10 mt-4 md:mt-0">
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
                  <MovieCard key={item.id} movie={{ ...item, media_type: "movie" }} size="sm" />
                ))}
              </div>
            </div>
          </section>
        )}

        <Footer />

        {/* Video Player Modal */}
        {showPlayer && id && (
          <VideoPlayer
            tmdbId={Number(id)}
            type="movie"
            onClose={() => setShowPlayer(false)}
          />
        )}
      </div>
    </>
  );
};

export default MovieDetails;
