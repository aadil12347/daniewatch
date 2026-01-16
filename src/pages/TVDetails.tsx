import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Play, Bookmark, Star, Tv, Calendar, ArrowLeft, Search, ChevronDown, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ActorCard } from "@/components/ActorCard";
import { MovieCard } from "@/components/MovieCard";
import { EpisodeCard } from "@/components/EpisodeCard";
import { BackgroundTrailer } from "@/components/BackgroundTrailer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { getMediaLinks, MediaLinkResult } from "@/lib/mediaLinks";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAuth } from "@/contexts/AuthContext";
import { useMedia } from "@/contexts/MediaContext";
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
  getTVEpisodeGroupDetails,
  EPISODE_GROUP_CONFIG,
  filterAdultContentStrict,
  TVDetails as TVDetailsType,
  Cast,
  Movie,
  Episode,
  EpisodeGroup,
  getBackdropUrl,
  getImageUrl,
  getYear,
} from "@/lib/tmdb";

const TVDetails = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [mediaResult, setMediaResult] = useState<MediaLinkResult | null>(null);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [episodeGroups, setEpisodeGroups] = useState<EpisodeGroup[] | null>(null);
  const [useEpisodeGroups, setUseEpisodeGroups] = useState(false);
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { user } = useAuth();
  const { setCurrentMedia, clearCurrentMedia } = useMedia();

  // URL-driven player state
  const playerState = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const isOpen = params.get("watch") === "1";
    const season = parseInt(params.get("s") || "1", 10);
    const episode = parseInt(params.get("e") || "1", 10);
    return { isOpen, season, episode };
  }, [location.search]);

  // Set media context when show loads or season changes
  useEffect(() => {
    if (show) {
      setCurrentMedia({
        title: show.name || '',
        type: 'tv',
        seasonNumber: selectedSeason,
      });
    }
    return () => clearCurrentMedia();
  }, [show?.id, show?.name, selectedSeason, setCurrentMedia, clearCurrentMedia]);

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
        
        // Filter similar shows with strict certification check
        const filteredSimilar = await filterAdultContentStrict(
          similarRes.results.map(s => ({ ...s, media_type: "tv" as const })),
          "tv"
        );
        setSimilar(filteredSimilar.slice(0, 14));

        // Get the first English logo or any available logo
        const logo = imagesRes.logos?.find(l => l.iso_639_1 === 'en') || imagesRes.logos?.[0];
        if (logo) {
          setLogoUrl(getImageUrl(logo.file_path, "w500"));
        }

        // Check if this show has a custom episode group
        const episodeGroupId = EPISODE_GROUP_CONFIG[Number(id)];

        if (episodeGroupId) {
          // Use episode groups (Parts) instead of standard seasons
          const groupDetails = await getTVEpisodeGroupDetails(episodeGroupId);
          setEpisodeGroups(groupDetails.groups);
          setUseEpisodeGroups(true);
          
          // Set first group's episodes
          const firstGroup = groupDetails.groups[0];
          if (firstGroup) {
            setSelectedSeason(1); // Use 1-based index for Parts
            // Map episode group episodes to standard Episode format
            setEpisodes(firstGroup.episodes.map((ep, index) => ({
              ...ep,
              episode_number: index + 1, // Use order as episode number
            })));
            
            // Check for media links (Supabase -> Blogger -> fallback)
            const mediaRes = await getMediaLinks(Number(id), "tv", 1);
            setMediaResult(mediaRes);
          }
        } else {
          // Use standard seasons (existing logic)
          setUseEpisodeGroups(false);
          setEpisodeGroups(null);
          
          // Find first valid season (skip season 0 which is usually specials)
          const firstSeason = showRes.seasons?.find(s => s.season_number > 0)?.season_number || 1;
          setSelectedSeason(firstSeason);

          // Fetch first season episodes
          const seasonRes = await getTVSeasonDetails(Number(id), firstSeason);
          setEpisodes(seasonRes.episodes || []);

          // Check for media links (Supabase -> Blogger -> fallback)
          const mediaRes = await getMediaLinks(Number(id), "tv", firstSeason);
          setMediaResult(mediaRes);
        }
      } catch (error) {
        console.error("Failed to fetch TV details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [id]);

  const handleSeasonChange = async (partOrSeasonNumber: number) => {
    if (!id || partOrSeasonNumber === selectedSeason) return;
    
    setSelectedSeason(partOrSeasonNumber);
    setIsLoadingEpisodes(true);
    setEpisodeSearch("");
    
    try {
      if (useEpisodeGroups && episodeGroups) {
        // Use episode groups (Parts)
        const group = episodeGroups[partOrSeasonNumber - 1]; // 1-based to 0-based
        if (group) {
          setEpisodes(group.episodes.map((ep, index) => ({
            ...ep,
            episode_number: index + 1,
          })));
        }
        
        // Check for media links (Supabase -> Blogger -> fallback) for selected part
        const mediaRes = await getMediaLinks(Number(id), "tv", partOrSeasonNumber);
        setMediaResult(mediaRes);
      } else {
        // Use standard seasons
        const seasonRes = await getTVSeasonDetails(Number(id), partOrSeasonNumber);
        setEpisodes(seasonRes.episodes || []);

        // Check for media links (Supabase -> Blogger -> fallback) for selected season
        const mediaRes = await getMediaLinks(Number(id), "tv", partOrSeasonNumber);
        setMediaResult(mediaRes);
      }
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

        {/* Hero Section - Full viewport height on desktop, shorter on mobile */}
        <div className="relative h-[70vh] md:h-screen md:min-h-[700px]">
          {/* Background Trailer or Video Player */}
          {playerState.isOpen && id ? (
            <VideoPlayer
              tmdbId={Number(id)}
              type="tv"
              season={playerState.season}
              episode={playerState.episode}
            onClose={() => navigate(-1)}
              inline
            />
          ) : (
            <BackgroundTrailer 
              videoKey={trailerKey} 
              backdropUrl={backdropUrl} 
              title={title} 
            />
          )}

          {/* Content - Bottom left positioned, adjusted for mobile */}
          <div className="absolute bottom-6 md:bottom-0 left-0 right-0 px-4 md:px-0 md:left-0 md:right-auto md:p-8 lg:p-12">
            <div className="animate-slide-up max-w-xl lg:max-w-2xl">
              {/* Logo */}
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={title} 
                  className="h-16 md:h-20 lg:h-24 object-contain object-left mb-3 md:mb-4"
                />
              ) : (
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4 leading-tight">
                  {title}
                </h1>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-2 md:mb-4">
                <div className="flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded bg-background/50 backdrop-blur-sm">
                  <Star className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold text-[10px] md:text-sm">{show.vote_average?.toFixed(1)}</span>
                </div>
                <span className="text-muted-foreground text-[10px] md:text-sm">{getYear(show.first_air_date)}</span>
                <span className="text-muted-foreground text-[10px] md:text-sm">•</span>
                <span className="text-muted-foreground text-[10px] md:text-sm">
                  {show.number_of_seasons} Season{show.number_of_seasons !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-1 md:gap-2 mb-2 md:mb-4">
                {show.genres?.slice(0, 3).map((genre) => (
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
                {show.overview}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-3 md:gap-3">
                <Button
                  size="sm"
                  className="gradient-red text-foreground font-semibold px-6 md:px-8 text-sm hover:opacity-90 transition-opacity shadow-glow h-11 md:h-10"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    // Add watch params to URL - this creates a history entry
                    const params = new URLSearchParams(location.search);
                    params.set("watch", "1");
                    params.set("s", String(selectedSeason));
                    params.set("e", "1");
                    navigate({ search: params.toString() });
                  }}
                >
                  <Play className="w-5 h-5 md:w-4 md:h-4 mr-2 fill-current" />
                  Play
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className={`w-11 h-11 md:w-10 md:h-10 rounded-full bg-secondary/50 border-border hover:bg-secondary/80 backdrop-blur-sm ${
                    isInWatchlist(show.id, 'tv') ? 'text-primary border-primary' : ''
                  }`}
                  onClick={async () => {
                    if (isBookmarking) return;
                    setIsBookmarking(true);
                    const showData: Movie = {
                      id: show.id,
                      title: show.name || '',
                      name: show.name,
                      overview: show.overview,
                      poster_path: show.poster_path,
                      backdrop_path: show.backdrop_path,
                      vote_average: show.vote_average,
                      first_air_date: show.first_air_date,
                      genre_ids: show.genres?.map(g => g.id) || [],
                      media_type: 'tv',
                    };
                    await toggleWatchlist(showData);
                    setIsBookmarking(false);
                  }}
                  disabled={isBookmarking}
                >
                  {isBookmarking ? (
                    <Loader2 className="w-5 h-5 md:w-4 md:h-4 animate-spin" />
                  ) : (
                    <Bookmark className={`w-5 h-5 md:w-4 md:h-4 ${isInWatchlist(show.id, 'tv') ? 'fill-current' : ''}`} />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Episodes / Similars Section - closer to hero on mobile */}
        <section className="py-3 md:py-10 -mt-6 md:mt-0">
          <div className="container mx-auto px-4 md:px-4">
            {/* Tabs */}
            <div className="flex items-center gap-3 md:gap-6 mb-3 md:mb-8">
              <button
                onClick={() => setActiveTab("episodes")}
                className={cn(
                  "text-sm md:text-lg font-semibold transition-all duration-300 relative pb-1 md:pb-2",
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
                  "text-sm md:text-lg font-semibold transition-all duration-300 relative pb-1 md:pb-2",
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-4 mb-3 md:mb-6">
                  {/* Mobile/Tablet: Side by side layout */}
                  <div className="flex md:hidden items-center gap-2 w-full">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-secondary/50 border-border flex-1 justify-between text-sm h-9">
                          {useEpisodeGroups ? `Part ${selectedSeason}` : `Season ${selectedSeason}`}
                          <ChevronDown className="w-4 h-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                        {useEpisodeGroups && episodeGroups ? (
                          episodeGroups.map((group, index) => (
                            <DropdownMenuItem
                              key={group.id}
                              onClick={() => handleSeasonChange(index + 1)}
                              className={cn(
                                "text-sm",
                                selectedSeason === index + 1 && "bg-primary/20"
                              )}
                            >
                              Part {index + 1}
                              <span className="ml-1 text-muted-foreground text-xs">
                                ({group.episodes.length} eps)
                              </span>
                            </DropdownMenuItem>
                          ))
                        ) : (
                          validSeasons.map((season) => (
                            <DropdownMenuItem
                              key={season.season_number}
                              onClick={() => handleSeasonChange(season.season_number)}
                              className={cn(
                                "text-sm",
                                selectedSeason === season.season_number && "bg-primary/20"
                              )}
                            >
                              Season {season.season_number}
                              <span className="ml-1 text-muted-foreground text-xs">
                                ({season.episode_count} eps)
                              </span>
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="relative min-w-[140px] flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={episodeSearch}
                        onChange={(e) => setEpisodeSearch(e.target.value)}
                        className="pl-9 bg-secondary/50 border-border text-sm h-9"
                      />
                    </div>
                  </div>

                  {/* Desktop: Original layout */}
                  <div className="hidden md:flex items-center gap-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="bg-secondary/50 border-border min-w-[140px] justify-between">
                          {useEpisodeGroups ? `Part ${selectedSeason}` : `Season ${selectedSeason}`}
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                        {useEpisodeGroups && episodeGroups ? (
                          episodeGroups.map((group, index) => (
                            <DropdownMenuItem
                              key={group.id}
                              onClick={() => handleSeasonChange(index + 1)}
                              className={cn(
                                selectedSeason === index + 1 && "bg-primary/20"
                              )}
                            >
                              Part {index + 1}
                              <span className="ml-2 text-muted-foreground text-xs">
                                ({group.episodes.length} eps)
                              </span>
                            </DropdownMenuItem>
                          ))
                        ) : (
                          validSeasons.map((season) => (
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
                          ))
                        )}
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
                        downloadLink={mediaResult?.seasonDownloadLinks?.[episode.episode_number - 1]}
                        onClick={() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          // Add watch params to URL for this episode
                          const params = new URLSearchParams(location.search);
                          params.set("watch", "1");
                          params.set("s", String(selectedSeason));
                          params.set("e", String(episode.episode_number));
                          navigate({ search: params.toString() });
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-4 justify-items-center">
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
