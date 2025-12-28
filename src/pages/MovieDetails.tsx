import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Play, Plus, Download, Star, Clock, Calendar, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ActorCard } from "@/components/ActorCard";
import { MovieCard } from "@/components/MovieCard";
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
  const trailer = movie.videos?.results.find(
    (v) => v.type === "Trailer" && v.site === "YouTube"
  );

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
          {/* Background Image */}
          <div className="absolute inset-0">
            {backdropUrl && (
              <img
                src={backdropUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            )}
            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
          </div>

          {/* Content - Bottom left positioned */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-16">
            <div className="container mx-auto">
              <div className="max-w-3xl animate-slide-up">
                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-background/50 backdrop-blur-sm">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold text-sm">{movie.vote_average?.toFixed(1)}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">{getYear(movie.release_date)}</span>
                  {movie.runtime && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground text-sm">{formatRuntime(movie.runtime)}</span>
                    </>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 leading-tight">
                  {movie.title}
                </h1>

                {/* Genres */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {movie.genres?.map((genre) => (
                    <span
                      key={genre.id}
                      className="px-3 py-1 rounded-full bg-secondary/60 backdrop-blur-sm text-xs font-medium"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>

                {/* Overview */}
                <p className="text-muted-foreground text-sm md:text-base max-w-2xl mb-6 line-clamp-3">
                  {movie.overview}
                </p>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    className="gradient-red text-foreground font-semibold px-8 hover:opacity-90 transition-opacity shadow-glow"
                    onClick={() => {
                      if (trailer) {
                        window.open(`https://www.youtube.com/watch?v=${trailer.key}`, "_blank");
                      }
                    }}
                  >
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    Play
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-12 h-12 rounded-full bg-secondary/50 border-border hover:bg-secondary/80 backdrop-blur-sm"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-12 h-12 rounded-full bg-secondary/50 border-border hover:bg-secondary/80 backdrop-blur-sm"
                  >
                    <Download className="w-5 h-5" />
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
