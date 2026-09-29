import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Loader2,
  ArrowLeft,
  ExternalLink,
  Play,
  Star,
  Clock,
  Calendar,
  Tv,
  Film,
  Download,
  Bookmark,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackgroundTrailer } from "@/components/BackgroundTrailer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ActorCard } from "@/components/ActorCard";
import {
  fetchPostFullDetails,
  type ScrapedPostDetail,
  type ScrapedEpisode,
  type ScrapedMovieQuality,
} from "@/lib/movieSiteScraper";
import { markExternalAllowed } from "@/lib/contentVisibility";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export default function PostDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();

  const postUrl = searchParams.get("url") || "";
  const initialTitle = searchParams.get("title") || "Loading Title...";
  const initialPoster = searchParams.get("poster") || "";
  const site = (searchParams.get("site") || "vegamovies") as "vegamovies" | "rogmovies";

  const [details, setDetails] = useState<ScrapedPostDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<ScrapedEpisode | null>(null);
  const [activeStreamUrl, setActiveStreamUrl] = useState<string | undefined>(undefined);
  const [currentSeason] = useState(1);
  const [currentEpNum, setCurrentEpNum] = useState(1);

  useEffect(() => {
    if (!postUrl) {
      setError("No post URL provided.");
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await fetchPostFullDetails(postUrl, initialTitle, initialPoster, site);
        if (!isMounted) return;

        setDetails(data);
        markExternalAllowed(data.tmdbId);

        if (data.episodes.length > 0) {
          setActiveEpisode(data.episodes[0]);
          setCurrentEpNum(data.episodes[0].episodeNumber);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("[PostDetail] Failed to load post details:", err);
        setError("Failed to extract IMDb/TMDB data and download links from this post.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [postUrl, initialTitle, initialPoster, site]);

  const handlePlayEpisode = (ep: ScrapedEpisode) => {
    haptic("tap");
    setActiveEpisode(ep);
    setCurrentEpNum(ep.episodeNumber);
    const linkToPlay = ep.vcloudUrl || ep.fallbackUrl;
    setActiveStreamUrl(linkToPlay);
    setIsPlayerOpen(true);
  };

  const handlePlayMovie = (quality?: ScrapedMovieQuality) => {
    haptic("tap");
    const linkToPlay = quality?.vcloudUrl || quality?.fallbackUrl;
    setActiveStreamUrl(linkToPlay);
    setIsPlayerOpen(true);
  };

  const handleDownload = (e: React.MouseEvent, url?: string) => {
    e.stopPropagation();
    if (!url) return;
    haptic("tap");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    haptic("tap");
    if (navigator.share) {
      try {
        await navigator.share({
          title: details?.title || initialTitle,
          url: window.location.href,
        });
      } catch {
        // ignore
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Post link copied to clipboard.",
      });
    }
  };

  const inWatchlist = details?.tmdbId ? isInWatchlist(details.tmdbId, details.mediaType) : false;

  const handleToggleWatchlist = () => {
    if (!details) return;
    haptic("tap");
    toggleWatchlist({
      id: details.tmdbId,
      media_type: details.mediaType,
      title: details.title,
      poster_path: details.posterUrl,
      backdrop_path: details.backdropUrl || undefined,
      vote_average: details.voteAverage,
      release_date: details.releaseYear,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
        <Helmet>
          <title>{initialTitle} - DanieWatch</title>
        </Helmet>

        {/* Top bar */}
        <div className="container mx-auto px-4 py-4 flex items-center justify-between border-b border-border/40">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <span
            className={cn(
              "text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider",
              site === "vegamovies"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-red-500/20 text-red-400 border border-red-500/30"
            )}
          >
            {site === "vegamovies" ? "VegaMovies" : "RogMovies"}
          </span>
        </div>

        {/* Skeleton hero */}
        <div className="container mx-auto px-4 py-8 max-w-5xl flex-1 flex flex-col items-center">
          <div className="w-full h-80 rounded-2xl bg-secondary/30 relative overflow-hidden mb-6 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Extracting IMDb code, TMDB trailer, poster thumbnails & V-Cloud links...
            </p>
          </div>
          <div className="w-full space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between border-b border-border/40">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <div className="container mx-auto px-4 py-16 max-w-md text-center flex flex-col items-center gap-4">
          <p className="text-destructive font-medium">{error || "Failed to load post details."}</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
            {postUrl && (
              <a
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline px-3 py-2"
              >
                Open Original Site
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Helmet>
        <title>{details.title} - DanieWatch</title>
        <meta name="description" content={details.overview} />
      </Helmet>

      {/* Video Player Modal/Overlay */}
      {isPlayerOpen && (
        <VideoPlayer
          tmdbId={details.tmdbId}
          type={details.mediaType}
          season={currentSeason}
          episode={currentEpNum}
          customStreamUrl={activeStreamUrl}
          title={details.title}
          posterPath={details.posterUrl}
          onClose={() => setIsPlayerOpen(false)}
        />
      )}

      {/* Hero / Trailer / Backdrop Area */}
      <div className="relative min-h-[55vh] md:min-h-[70vh] flex flex-col justify-between overflow-hidden">
        {/* Background trailer or backdrop */}
        {details.trailerKey ? (
          <BackgroundTrailer
            videoKey={details.trailerKey}
            backdropUrl={details.backdropUrl}
            title={details.title}
          />
        ) : (
          <div className="absolute inset-0">
            {details.backdropUrl ? (
              <img
                src={details.backdropUrl}
                alt={details.title}
                className="w-full h-full object-cover transition-opacity duration-700"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-secondary/50 via-background to-background" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
          </div>
        )}

        {/* Top Navbar */}
        <div className="relative z-20 container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 bg-background/50 backdrop-blur-md border border-border/40 hover:bg-background/80"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {details.imdbId && (
              <a
                href={`https://www.imdb.com/title/${details.imdbId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 backdrop-blur-md"
              >
                IMDb {details.imdbId}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <span
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider backdrop-blur-md shadow-md",
                details.originSite === "vegamovies"
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                  : "bg-red-950/80 text-red-300 border border-red-500/40"
              )}
            >
              {details.originSite === "vegamovies" ? "VegaMovies" : "RogMovies"}
            </span>
          </div>
        </div>

        {/* Hero Title & Meta */}
        <div className="relative z-10 container mx-auto px-4 pb-12 pt-16 max-w-6xl">
          <div className="max-w-2xl animate-fade-in">
            {/* Logo or Title */}
            {details.logoUrl ? (
              <img
                src={details.logoUrl}
                alt={details.title}
                className="max-h-20 md:max-h-28 object-contain object-left mb-4 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
              />
            ) : (
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3 leading-tight drop-shadow-md">
                {details.title}
              </h1>
            )}

            {/* Badges / Meta */}
            <div className="flex flex-wrap items-center gap-2.5 mb-4 text-xs md:text-sm">
              <span className="flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {details.voteAverage}
              </span>
              <span className="px-2 py-0.5 rounded bg-secondary/80 text-muted-foreground font-medium">
                {details.releaseYear}
              </span>
              {details.runtime && (
                <span className="px-2 py-0.5 rounded bg-secondary/80 text-muted-foreground font-medium">
                  {details.runtime}
                </span>
              )}
              <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-semibold uppercase tracking-wider">
                {details.mediaType === "tv" ? "TV Series" : "Movie"}
              </span>
            </div>

            {/* Genres */}
            {details.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {details.genres.map((g) => (
                  <span
                    key={g}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary/60 text-secondary-foreground border border-border/40"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Overview */}
            {details.overview && (
              <p className="text-sm md:text-base text-muted-foreground/90 line-clamp-3 md:line-clamp-4 leading-relaxed mb-6">
                {details.overview}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="gap-2.5 font-bold shadow-glow text-base px-6 h-12"
                onClick={() => {
                  if (details.mediaType === "tv" && details.episodes.length > 0) {
                    handlePlayEpisode(details.episodes[0]);
                  } else {
                    handlePlayMovie(details.movieQualities[0]);
                  }
                }}
              >
                <Play className="w-5 h-5 fill-current" />
                {details.mediaType === "tv" ? "Play Episode 1" : "Play Movie"}
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="gap-2 h-12 bg-secondary/40 backdrop-blur-md"
                onClick={handleToggleWatchlist}
              >
                <Bookmark className={cn("w-4 h-4", inWatchlist && "fill-primary text-primary")} />
                {inWatchlist ? "In Watchlist" : "Watchlist"}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-xl bg-secondary/40 backdrop-blur-md"
                onClick={handleShare}
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </Button>

              {postUrl && (
                <a
                  href={postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border/40 bg-secondary/20"
                >
                  Source Post
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-12">
        {/* Episodes Section (for TV Series) */}
        {details.mediaType === "tv" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <Tv className="w-5 h-5 text-primary" />
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">Episodes</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary font-semibold text-muted-foreground">
                  {details.episodes.length} Available
                </span>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                V-Cloud Powered
              </span>
            </div>

            {/* Episode Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {details.episodes.map((ep) => {
                const isActive = activeEpisode?.episodeNumber === ep.episodeNumber;
                return (
                  <div
                    key={ep.episodeNumber}
                    onClick={() => handlePlayEpisode(ep)}
                    className={cn(
                      "flex gap-3 md:gap-4 p-3 rounded-xl border transition-all duration-300 cursor-pointer group bg-card/60 hover:bg-secondary/40",
                      isActive
                        ? "border-primary ring-1 ring-primary/40 bg-primary/5"
                        : "border-border/40 hover:border-border"
                    )}
                  >
                    {/* Thumbnail from TMDB */}
                    <div className="relative flex-shrink-0 w-32 md:w-44 aspect-video rounded-lg overflow-hidden bg-secondary">
                      {ep.thumbnailUrl ? (
                        <img
                          src={ep.thumbnailUrl}
                          alt={ep.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          Episode {ep.episodeNumber}
                        </div>
                      )}

                      {/* Episode Badge */}
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/75 text-white backdrop-blur-md">
                        EP {ep.episodeNumber < 10 ? `0${ep.episodeNumber}` : ep.episodeNumber}
                      </span>

                      {/* Play Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="p-2 rounded-full bg-primary text-primary-foreground shadow-lg">
                          <Play className="w-4 h-4 fill-current" />
                        </div>
                      </div>
                    </div>

                    {/* Episode Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {ep.title}
                          </h3>
                        </div>
                        {ep.overview ? (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {ep.overview}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 italic">
                            Episode {ep.episodeNumber} of {details.title}
                          </p>
                        )}
                      </div>

                      {/* Episode Action / Link Tags */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1.5">
                          {ep.vcloudUrl ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              V-Cloud
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Direct Link
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {ep.resolution || "720p"}
                          </span>
                        </div>

                        {/* Download / Open Button */}
                        {(ep.vcloudUrl || ep.fallbackUrl) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={(e) => handleDownload(e, ep.vcloudUrl || ep.fallbackUrl)}
                            title="Direct Download / Link"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Movie Download & Stream Qualities (for Movies) */}
        {details.mediaType === "movie" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <Film className="w-5 h-5 text-primary" />
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">Available Streams & Downloads</h2>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Fast V-Cloud Servers
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {details.movieQualities.map((q) => (
                <div
                  key={q.resolution}
                  className="p-4 rounded-xl border border-border/40 bg-card/60 flex flex-col justify-between gap-3 hover:border-border transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{q.label}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/20 text-primary">
                      {q.resolution}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 font-semibold text-xs"
                      onClick={() => handlePlayMovie(q)}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Stream
                    </Button>

                    {(q.vcloudUrl || q.fallbackUrl) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={(e) => handleDownload(e, q.vcloudUrl || q.fallbackUrl)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cast Section */}
        {details.cast.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">Top Cast</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
              {details.cast.map((actor, idx) => (
                <ActorCard
                  key={idx}
                  actor={{
                    id: idx,
                    name: actor.name,
                    character: actor.character,
                    profile_path: actor.profileUrl ? actor.profileUrl.replace("https://image.tmdb.org/t/p/w185", "") : null,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
