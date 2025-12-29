import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Play, Plus, Download, Star, Clock, Calendar, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ActorCard } from "@/components/ActorCard";
import { MovieCard } from "@/components/MovieCard";
import { BackgroundTrailer } from "@/components/BackgroundTrailer";
import { CustomVideoPlayer } from "@/components/CustomVideoPlayer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

        {/* Hero Section - Full viewport height */}
        <div className="relative h-screen min-h-[700px]">
          {/* Background Trailer */}
          <BackgroundTrailer 
            videoKey={trailerKey} 
            backdropUrl={backdropUrl} 
            title={movie.title} 
          />

          {/* Content - Bottom left positioned */}
          <div className="absolute bottom-0 left-0 p-4 md:p-8 lg:p-12">
            <div className="animate-slide-up max-w-xl lg:max-w-2xl">
              {/* Logo */}
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={movie.title} 
                  className="h-16 md:h-20 lg:h-24 object-contain object-left mb-4"
                />
              ) : (
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                  {movie.title}
                </h1>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-background/50 backdrop-blur-sm">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold text-sm">{movie.vote_average?.toFixed(1)}</span>
                </div>
                <span className="text-muted-foreground text-sm">{getYear(movie.release_date)}</span>
                {movie.runtime && (
                  <>
                    <span className="text-muted-foreground text-sm">•</span>
                    <span className="text-muted-foreground text-sm">{formatRuntime(movie.runtime)}</span>
                  </>
                )}
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-4">
                {movie.genres?.slice(0, 3).map((genre) => (
                  <span
                    key={genre.id}
                    className="px-2.5 py-1 rounded-full bg-secondary/60 backdrop-blur-sm text-xs font-medium"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              {/* Overview */}
              <p className="text-muted-foreground text-sm md:text-base mb-5 line-clamp-3">
                {movie.overview}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <Button
                  size="default"
                  className="gradient-red text-foreground font-semibold px-8 hover:opacity-90 transition-opacity shadow-glow"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setShowPlayer(true);
                  }}
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Play
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="w-10 h-10 rounded-full bg-secondary/50 border-border hover:bg-secondary/80 backdrop-blur-sm"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="w-10 h-10 rounded-full bg-secondary/50 border-border hover:bg-secondary/80 backdrop-blur-sm"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Cast Section */}
        {cast.length > 0 && (
          <section className="py-10">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl font-bold mb-6">Actors</h2>
              <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-4">
                {cast.map((actor) => (
                  <ActorCard key={actor.id} actor={actor} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Similar Movies */}
        {similar.length > 0 && (
          <section className="py-10">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl font-bold mb-6">You may like</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                {similar.map((item) => (
                  <MovieCard key={item.id} movie={{ ...item, media_type: "movie" }} size="sm" />
                ))}
              </div>
            </div>
          </section>
        )}

        <Footer />

        {/* Custom Video Player Modal */}
        {showPlayer && id && (
          <CustomVideoPlayer
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
