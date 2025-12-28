import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Play, Plus, Download, Star, Tv, Calendar, ArrowLeft, Search, ChevronDown } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ActorCard } from "@/components/ActorCard";
import { MovieCard } from "@/components/MovieCard";
import { EpisodeCard } from "@/components/EpisodeCard";
import { BackgroundTrailer } from "@/components/BackgroundTrailer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getTVDetails,
  getTVCredits,
  getSimilarTV,
  getTVSeasonDetails,
  getTVImages,
  TVDetails as TVDetailsType,
  Cast,
  Movie,
  Episode,
  getBackdropUrl,
  getImageUrl,
  getYear,
} from "@/lib/tmdb";

const TVDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [show, setShow] = useState<TVDetailsType | null>(null);
  const [cast, setCast] = useState<Cast[]>([]);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [activeTab, setActiveTab] = useState<"episodes" | "similars">("episodes");
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      try {
        const [showRes, creditsRes, similarRes, imagesRes] = await Promise.all([
          getTVDetails(Number(id)),
          getTVCredits(Number(id)),
          getSimilarTV(Number(id)),
          getTVImages(Number(id)),
        ]);

        setShow(showRes);
        setCast(creditsRes.cast.slice(0, 12));
        setSimilar(similarRes.results.slice(0, 14));

        // Get the first English logo or any available logo
        const logo = imagesRes.logos?.find(l => l.iso_639_1 === 'en') || imagesRes.logos?.[0];
        if (logo) {
          setLogoUrl(getImageUrl(logo.file_path, "w500"));
        }

        // Find first valid season (skip season 0 which is usually specials)
        const firstSeason = showRes.seasons?.find(s => s.season_number > 0)?.season_number || 1;
        setSelectedSeason(firstSeason);

        // Fetch first season episodes
        const seasonRes = await getTVSeasonDetails(Number(id), firstSeason);
        setEpisodes(seasonRes.episodes || []);
      } catch (error) {
        console.error("Failed to fetch TV details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [id]);

  const handleSeasonChange = async (seasonNumber: number) => {
    if (!id || seasonNumber === selectedSeason) return;
    
    setSelectedSeason(seasonNumber);
    setIsLoadingEpisodes(true);
    setEpisodeSearch("");
    
    try {
      const seasonRes = await getTVSeasonDetails(Number(id), seasonNumber);
      setEpisodes(seasonRes.episodes || []);
    } catch (error) {
      console.error("Failed to fetch season:", error);
      setEpisodes([]);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  const filteredEpisodes = episodes.filter(ep =>
    ep.name.toLowerCase().includes(episodeSearch.toLowerCase()) ||
    ep.overview?.toLowerCase().includes(episodeSearch.toLowerCase())
  );

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
  const title = show.name || "Unknown";
  const trailer = show.videos?.results.find(
    (v) => v.type === "Trailer" && v.site === "YouTube"
  );
  const trailerKey = trailer?.key || null;
  
  // Get valid seasons (usually season 0 is specials)
  const validSeasons = show.seasons?.filter(s => s.season_number > 0) || [];

  return (
    <>
      <Helmet>
        <title>{title} - DanieWatch</title>
        <meta name="description" content={show.overview?.slice(0, 160)} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        {/* Hero Section - Full viewport height */}
        <div className="relative h-screen min-h-[700px]">
          {/* Background Trailer */}
          <BackgroundTrailer 
            videoKey={trailerKey} 
            backdropUrl={backdropUrl} 
            title={title} 
          />

          {/* Content - Bottom left positioned */}
          <div className="absolute bottom-0 left-0 p-4 md:p-8 lg:p-12">
            <div className="animate-slide-up max-w-xl lg:max-w-2xl">
              {/* Logo */}
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={title} 
                  className="h-16 md:h-20 lg:h-24 object-contain object-left mb-4"
                />
              ) : (
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                  {title}
                </h1>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-background/50 backdrop-blur-sm">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold text-sm">{show.vote_average?.toFixed(1)}</span>
                </div>
                <span className="text-muted-foreground text-sm">{getYear(show.first_air_date)}</span>
                <span className="text-muted-foreground text-sm">•</span>
                <span className="text-muted-foreground text-sm">
                  {show.number_of_seasons} Season{show.number_of_seasons !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-4">
                {show.genres?.slice(0, 3).map((genre) => (
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
                {show.overview}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <Button
                  size="default"
                  className="gradient-red text-foreground font-semibold px-8 hover:opacity-90 transition-opacity shadow-glow"
                  onClick={() => {
                    if (trailer) {
                      window.open(`https://www.youtube.com/watch?v=${trailer.key}`, "_blank");
                    }
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

        {/* Episodes / Similars Section */}
        <section className="py-10">
          <div className="container mx-auto px-4">
            {/* Tabs */}
            <div className="flex items-center gap-6 mb-8">
              <button
                onClick={() => setActiveTab("episodes")}
                className={cn(
                  "text-lg font-semibold transition-all duration-300 relative pb-2",
                  activeTab === "episodes"
                    ? "text-foreground tab-glow-active"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Episodes
              </button>
              <button
                onClick={() => setActiveTab("similars")}
                className={cn(
                  "text-lg font-semibold transition-all duration-300 relative pb-2",
                  activeTab === "similars"
                    ? "text-foreground tab-glow-active"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Similars
              </button>
            </div>

            {activeTab === "episodes" && (
              <div className="tab-content-enter">
                {/* Season selector and search */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                  {/* Mobile/Tablet: Side by side layout */}
                  <div className="flex md:hidden items-center gap-2 w-full">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="bg-secondary/50 border-border flex-1 justify-between">
                          Season {selectedSeason}
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                        {validSeasons.map((season) => (
                          <DropdownMenuItem
                            key={season.season_number}
                            onClick={() => handleSeasonChange(season.season_number)}
                            className={cn(
                              selectedSeason === season.season_number && "bg-primary/20"
                            )}
                          >
                            Season {season.season_number}
                            <span className="ml-2 text-muted-foreground text-xs">
                              ({season.episode_count} eps)
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="relative min-w-[160px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search episode..."
                        value={episodeSearch}
                        onChange={(e) => setEpisodeSearch(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border"
                      />
                    </div>
                  </div>

                  {/* Desktop: Original layout */}
                  <div className="hidden md:flex items-center gap-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="bg-secondary/50 border-border min-w-[140px] justify-between">
                          Season {selectedSeason}
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                        {validSeasons.map((season) => (
                          <DropdownMenuItem
                            key={season.season_number}
                            onClick={() => handleSeasonChange(season.season_number)}
                            className={cn(
                              selectedSeason === season.season_number && "bg-primary/20"
                            )}
                          >
                            Season {season.season_number}
                            <span className="ml-2 text-muted-foreground text-xs">
                              ({season.episode_count} eps)
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search episode..."
                        value={episodeSearch}
                        onChange={(e) => setEpisodeSearch(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Episode list */}
                <div className="space-y-2">
                  {isLoadingEpisodes ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-4 p-3">
                        <Skeleton className="w-40 aspect-video rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-3/4 mb-2" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-2/3 mt-1" />
                        </div>
                      </div>
                    ))
                  ) : filteredEpisodes.length > 0 ? (
                    filteredEpisodes.map((episode) => (
                      <EpisodeCard
                        key={episode.id}
                        episode={episode}
                        onClick={() => {
                          // Could navigate to a player page
                          console.log("Play episode:", episode.episode_number);
                        }}
                      />
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No episodes found
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "similars" && (
              <div className="tab-content-enter">
                {similar.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4 justify-items-center md:justify-items-start">
                    {similar.map((item) => (
                      <MovieCard key={item.id} movie={{ ...item, media_type: "tv" }} size="sm" />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No similar shows found
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

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

        <Footer />
      </div>
    </>
  );
};

export default TVDetails;
