import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Play, Plus, Download, Star, Clock, Calendar, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ActorCard } from "@/components/ActorCard";
import { MovieCard } from "@/components/MovieCard";
import { BackgroundTrailer } from "@/components/BackgroundTrailer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMovieDetails,
  getMovieCredits,
  getSimilarMovies,
  MovieDetails as MovieDetailsType,
  Cast,
  Movie,
  getBackdropUrl,
  getPosterUrl,
  formatRuntime,
  getYear,
} from "@/lib/tmdb";

const MovieDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<MovieDetailsType | null>(null);
  const [cast, setCast] = useState<Cast[]>([]);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      try {
        const [movieRes, creditsRes, similarRes] = await Promise.all([
          getMovieDetails(Number(id)),
          getMovieCredits(Number(id)),
          getSimilarMovies(Number(id)),
        ]);

        setMovie(movieRes);
        setCast(creditsRes.cast.slice(0, 12));
        setSimilar(similarRes.results.slice(0, 14));
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
  const posterUrl = getPosterUrl(movie.poster_path, "w500");
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

          {/* Content - Bottom left positioned with poster */}
          <div className="absolute bottom-0 left-0 p-4 md:p-8 lg:p-12">
            <div className="flex items-end gap-4 md:gap-6 animate-slide-up">
              {/* Poster */}
              <div className="hidden sm:block flex-shrink-0 w-32 md:w-40 lg:w-48 rounded-lg overflow-hidden shadow-card">
                {posterUrl ? (
                  <img src={posterUrl} alt={movie.title} className="w-full aspect-[2/3] object-cover" />
                ) : (
                  <div className="w-full aspect-[2/3] bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-xs">{movie.title}</span>
                  </div>
                )}
              </div>

              {/* Info card */}
              <div className="max-w-md lg:max-w-lg">
                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-background/50 backdrop-blur-sm">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold text-xs">{movie.vote_average?.toFixed(1)}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">{getYear(movie.release_date)}</span>
                  {movie.runtime && (
                    <>
                      <span className="text-muted-foreground text-xs">•</span>
                      <span className="text-muted-foreground text-xs">{formatRuntime(movie.runtime)}</span>
                    </>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 leading-tight">
                  {movie.title}
                </h1>

                {/* Genres */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {movie.genres?.slice(0, 3).map((genre) => (
                    <span
                      key={genre.id}
                      className="px-2 py-0.5 rounded-full bg-secondary/60 backdrop-blur-sm text-xs font-medium"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>

                {/* Overview */}
                <p className="text-muted-foreground text-xs md:text-sm mb-4 line-clamp-2">
                  {movie.overview}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="gradient-red text-foreground font-semibold px-6 hover:opacity-90 transition-opacity shadow-glow"
                    onClick={() => {
                      if (trailer) {
                        window.open(`https://www.youtube.com/watch?v=${trailer.key}`, "_blank");
                      }
                    }}
                  >
                    <Play className="w-4 h-4 mr-1.5 fill-current" />
                    Play
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-9 h-9 rounded-full bg-secondary/50 border-border hover:bg-secondary/80 backdrop-blur-sm"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-9 h-9 rounded-full bg-secondary/50 border-border hover:bg-secondary/80 backdrop-blur-sm"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
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
      </div>
    </>
  );
};

export default MovieDetails;
