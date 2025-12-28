import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Play, Plus, Download, Star, Tv, Calendar, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ActorCard } from "@/components/ActorCard";
import { MovieCard } from "@/components/MovieCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTVDetails,
  getTVCredits,
  getSimilarTV,
  TVDetails as TVDetailsType,
  Cast,
  Movie,
  getBackdropUrl,
  getPosterUrl,
  getYear,
} from "@/lib/tmdb";

const TVDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [show, setShow] = useState<TVDetailsType | null>(null);
  const [cast, setCast] = useState<Cast[]>([]);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      try {
        const [showRes, creditsRes, similarRes] = await Promise.all([
          getTVDetails(Number(id)),
          getTVCredits(Number(id)),
          getSimilarTV(Number(id)),
        ]);

        setShow(showRes);
        setCast(creditsRes.cast.slice(0, 12));
        setSimilar(similarRes.results.slice(0, 14));
      } catch (error) {
        console.error("Failed to fetch TV details:", error);
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
        <div className="h-[70vh] relative">
          <Skeleton className="absolute inset-0" />
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 text-center">
          <h1 className="text-2xl font-bold mb-4">TV Show not found</h1>
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

  const backdropUrl = getBackdropUrl(show.backdrop_path);
  const posterUrl = getPosterUrl(show.poster_path, "w500");
  const title = show.name || "Unknown";
  const trailer = show.videos?.results.find(
    (v) => v.type === "Trailer" && v.site === "YouTube"
  );

  return (
    <>
      <Helmet>
        <title>{title} - Cineby</title>
        <meta name="description" content={show.overview?.slice(0, 160)} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        {/* Hero Section */}
        <div className="relative h-[80vh] min-h-[600px]">
          {/* Background */}
          <div className="absolute inset-0">
            {backdropUrl && (
              <img
                src={backdropUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 gradient-hero" />
            <div className="absolute inset-0 gradient-hero-bottom" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative container mx-auto h-full flex items-end pb-16 px-4">
            <div className="flex flex-col md:flex-row gap-8 items-end md:items-end">
              {/* Poster */}
              <div className="hidden md:block flex-shrink-0 w-64 rounded-xl overflow-hidden shadow-card animate-scale-in">
                {posterUrl ? (
                  <img src={posterUrl} alt={title} className="w-full" />
                ) : (
                  <div className="aspect-[2/3] bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground">{title}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 animate-slide-up">
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-md glass">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold">{show.vote_average?.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{getYear(show.first_air_date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Tv className="w-4 h-4" />
                    <span>{show.number_of_seasons} Season{show.number_of_seasons !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4">
                  {title}
                </h1>

                {/* Tagline */}
                {show.tagline && (
                  <p className="text-lg text-primary italic mb-4">{show.tagline}</p>
                )}

                {/* Genres */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {show.genres?.map((genre) => (
                    <span
                      key={genre.id}
                      className="px-4 py-1.5 rounded-full bg-secondary/50 text-sm font-medium"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>

                {/* Overview */}
                <p className="text-muted-foreground max-w-2xl mb-8 line-clamp-3 md:line-clamp-none">
                  {show.overview}
                </p>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-4">
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
                    size="lg"
                    variant="outline"
                    className="bg-secondary/50 border-border hover:bg-secondary/80"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add to List
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="bg-secondary/50 border-border hover:bg-secondary/80"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download
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

        {/* Similar Shows */}
        {similar.length > 0 && (
          <section className="py-10">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl font-bold mb-6">You may like</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                {similar.map((item) => (
                  <MovieCard key={item.id} movie={{ ...item, media_type: "tv" }} size="sm" />
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

export default TVDetails;
