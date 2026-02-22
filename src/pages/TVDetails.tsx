import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { Bookmark, Star, Tv, Calendar, ArrowLeft, Search, ChevronDown, Loader2, ExternalLink } from "lucide-react";

import { Footer } from "@/components/Footer";
import { ActorCard } from "@/components/ActorCard";
import { MovieCard } from "@/components/MovieCard";
import { EpisodeCard } from "@/components/EpisodeCard";
import { BackgroundTrailer } from "@/components/BackgroundTrailer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { AnimatedPlayButton } from "@/components/AnimatedPlayButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { getMediaLinks, MediaLinkResult } from "@/lib/mediaLinks";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAdmin } from "@/hooks/useAdmin";
import { useEntries } from "@/hooks/useEntries";
import { usePostModeration } from "@/hooks/usePostModeration";
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
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { useContentAccess } from "@/hooks/useContentAccess";
import { supabase } from "@/integrations/supabase/client";

type TVDetailsProps = {
  modal?: boolean;
};

const TVDetails = ({ modal = false }: TVDetailsProps) => {
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
  const [imdbId, setImdbId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [mediaResult, setMediaResult] = useState<MediaLinkResult | null>(null);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [optimisticInWatchlist, setOptimisticInWatchlist] = useState<boolean | null>(null);
  const [watchlistAnim, setWatchlistAnim] = useState<"add" | "remove" | null>(null);
  const [revealOrigin, setRevealOrigin] = useState<{ x: number; y: number } | null>(null);
  const [episodeGroups, setEpisodeGroups] = useState<EpisodeGroup[] | null>(null);
  const [useEpisodeGroups, setUseEpisodeGroups] = useState(false);

  const heroRef = useRef<HTMLDivElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);

  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { user } = useAuth();
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const { isLoading: isModerationLoading, isBlocked } = usePostModeration();
  const { setCurrentMedia, clearCurrentMedia } = useMedia();

  const [blockedForUser, setBlockedForUser] = useState(false);

  // URL-driven player state
  const playerState = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const isOpen = params.get("watch") === "1";
    const season = parseInt(params.get("s") || "1", 10);
    const episode = parseInt(params.get("e") || "1", 10);
    return { isOpen, season, episode };
  }, [location.search]);

  // Check for autoPlay state from continue watching navigation
  const autoPlayState = useMemo(() => {
    const state = location.state as { autoPlay?: boolean; season?: number; episode?: number } | null;
    return state?.autoPlay ? state : null;
  }, [location.state]);

  // Auto-open player when navigating from continue watching
  useEffect(() => {
    if (autoPlayState && show && !playerState.isOpen) {
      const season = autoPlayState.season || 1;
      const episode = autoPlayState.episode || 1;
      // Navigate to open the player with specific season/episode
      navigate(`?watch=1&s=${season}&e=${episode}`, { replace: true, state: null });
    }
  }, [autoPlayState, show, playerState.isOpen, navigate]);

  // Set media context when show loads or season changes
  useEffect(() => {
    if (!show) return;
    setCurrentMedia({ title: show.name, type: 'tv', tmdbId: show.id, seasonNumber: selectedSeason });
    return () => {
      clearCurrentMedia();
    };
  }, [show, selectedSeason, setCurrentMedia, clearCurrentMedia]);

  const extendEpisodesWithDbLinks = (
    baseEpisodes: Episode[],
    links: MediaLinkResult | null,
    tmdbId: number,
    seasonNumber: number
  ): Episode[] => {
    const dbWatchCount = links?.seasonEpisodeLinks?.length ?? 0;
    const dbDownloadCount = links?.seasonDownloadLinks?.length ?? 0;
    const dbCount = Math.max(dbWatchCount, dbDownloadCount);

    const tmdbCount = baseEpisodes.length;
    const effectiveCount = Math.max(tmdbCount, dbCount);

    if (effectiveCount <= tmdbCount) return baseEpisodes;

    const placeholders: Episode[] = Array.from({ length: effectiveCount - tmdbCount }, (_, i) => {
      const epNum = tmdbCount + i + 1;
      return {
        id: -(tmdbId * 10000 + seasonNumber * 100 + epNum),
        name: `Episode ${epNum}`,
        episode_number: epNum,
        season_number: seasonNumber,
        overview: "",
        still_path: null,
        air_date: null,
        runtime: null,
        vote_average: 0,
      };
    });

    return [...baseEpisodes, ...placeholders];
  };
  const displayedInWatchlist =
    optimisticInWatchlist !== null ? optimisticInWatchlist : isInWatchlist(show?.id ?? 0, "tv");

  useEffect(() => {
    if (show && optimisticInWatchlist !== null && optimisticInWatchlist === isInWatchlist(show.id, "tv")) {
      setOptimisticInWatchlist(null);
    }
  }, [show?.id, optimisticInWatchlist, isInWatchlist]);

  const { isAccessible, isLoading: isAccessLoading } = useContentAccess();

  useEffect(() => {
    if (!id) return;
    if (isAdminLoading || isModerationLoading || isAccessLoading) return;

    const blocked = isBlocked(Number(id), 'tv');
    const notInManifest = !isAccessible(Number(id), 'tv');

    if ((blocked && !isAdmin) || notInManifest) {
      setBlockedForUser(true);
      setShow(null);
      setCast([]);
      setSimilar([]);
      setEpisodes([]);
      setLogoUrl(null);
      setMediaResult(null);
      setIsLoading(false);
    } else {
      setBlockedForUser(false);
    }
  }, [id, isAdminLoading, isModerationLoading, isBlocked, isAdmin, isAccessible, isAccessLoading]);

  const { fetchEntry } = useEntries();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      if (blockedForUser) return;
      setIsLoading(true);

      try {
        const [showRes, creditsRes, similarRes, imagesRes, dbEntry] = await Promise.all([
          getTVDetails(Number(id)),
          getTVCredits(Number(id)),
          getSimilarTV(Number(id)),
          getTVImages(Number(id)),
          fetchEntry(id),
        ]);

        // Determine if DB entry has active links (for series, check any season)
        let hasActiveLinks = false;
        if (dbEntry?.content) {
          if (dbEntry.type === "series") {
            hasActiveLinks = Object.values(dbEntry.content).some((season: any) => {
              const watchLinks = season?.watch_links as string[] | undefined;
              const downloadLinks = season?.download_links as string[] | undefined;
              return (
                watchLinks?.some((l) => l && l.trim().length > 0) ||
                downloadLinks?.some((l) => l && l.trim().length > 0)
              );
            });
          } else if (dbEntry.type === "movie") {
            const content = dbEntry.content as { watch_link?: string; download_link?: string };
            hasActiveLinks = !!(content.watch_link?.trim() || content.download_link?.trim());
          }
        }

        console.log("[TVDetails] ID:", id, "hasActiveLinks:", hasActiveLinks, "dbEntry:", dbEntry);

        // Merge DB data with TMDB data.
        // When entry has active links, use DB fields if they are NOT null/undefined.
        // This prevents empty strings or 0 values from being overwritten.
        const mergedShow: TVDetailsType = {
          ...showRes,
          name: hasActiveLinks && dbEntry?.title != null ? dbEntry.title : showRes.name,
          overview: hasActiveLinks && dbEntry?.overview != null ? dbEntry.overview : showRes.overview,
          poster_path: hasActiveLinks && dbEntry?.poster_url != null ? dbEntry.poster_url : showRes.poster_path,
          backdrop_path: hasActiveLinks && dbEntry?.backdrop_url != null ? dbEntry.backdrop_url : showRes.backdrop_path,
          vote_average: hasActiveLinks && dbEntry?.vote_average != null ? dbEntry.vote_average : showRes.vote_average,
          tagline: hasActiveLinks && dbEntry?.tagline != null ? dbEntry.tagline : showRes.tagline,
        };

        if (hasActiveLinks && dbEntry?.genres != null) {
          mergedShow.genres = dbEntry.genres;
        }

        // Set IMDb ID from DB entry
        if (dbEntry?.imdb_id) {
          setImdbId(dbEntry.imdb_id);
        }

        setShow(mergedShow);
        setCast(creditsRes.cast.slice(0, 12));

        // Filter similar shows with strict certification check
        const filteredSimilar = (await filterAdultContentStrict(
          similarRes.results.map((s) => ({ ...s, media_type: "tv" as const })),
          "tv"
        )) as Movie[];
        setSimilar(filteredSimilar.slice(0, 14));

        // Priority for Logo: DB (if has links and logo exists) -> TMDB
        const dbLogo = hasActiveLinks && dbEntry?.logo_url != null ? dbEntry.logo_url : null;
        if (dbLogo) {
          setLogoUrl(dbLogo);
        } else {
          const logo = imagesRes.logos?.find((l) => l.iso_639_1 === 'en') || imagesRes.logos?.[0];
          if (logo) {
            setLogoUrl(getImageUrl(logo.file_path, "w500"));
          }
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
            const partIndex = 1; // 1-based index for Parts
            setSelectedSeason(partIndex);

            const baseEpisodes: Episode[] = firstGroup.episodes.map((ep, index) => ({
              ...ep,
              episode_number: index + 1,
              season_number: partIndex,
            }));

            // Fetch links and extend episode list if DB has more links than TMDB
            const mediaRes = await getMediaLinks(Number(id), "tv", partIndex);
            setMediaResult(mediaRes);
            setEpisodes(extendEpisodesWithDbLinks(baseEpisodes, mediaRes, Number(id), partIndex));
          }
        } else {
          // Use standard seasons (existing logic)
          setUseEpisodeGroups(false);
          setEpisodeGroups(null);

          // Find first valid season (skip season 0 which is usually specials)
          const firstSeason = showRes.seasons?.find((s) => s.season_number > 0)?.season_number || 1;
          setSelectedSeason(firstSeason);

          // First, check for stored episode metadata in database
          const { data: storedEpisodes } = await supabase
            .from("entry_metadata")
            .select("*")
            .eq("entry_id", String(id))
            .eq("season_number", firstSeason)
            .order("episode_number", { ascending: true });

          let baseEpisodes: Episode[];

          if (storedEpisodes && storedEpisodes.length > 0) {
            // Use stored episode data from database strictly (don't extend with links)
            baseEpisodes = storedEpisodes.map((ep) => ({
              id: ep.episode_number,
              name: ep.name || `Episode ${ep.episode_number}`,
              episode_number: ep.episode_number,
              season_number: ep.season_number,
              overview: ep.overview || "",
              still_path: ep.still_path,
              air_date: ep.air_date,
              runtime: ep.runtime,
              vote_average: ep.vote_average || 0,
            }));

            // Just set episodes directly - do NOT extend with placeholder links if admin defined the list
            setEpisodes(baseEpisodes);

            // Still fetch media result for download button context if needed elsewhere
            const mediaRes = await getMediaLinks(Number(id), "tv", firstSeason);
            setMediaResult(mediaRes);
          } else {
            // Fall back to TMDB - use standard behavior (can extend)
            const seasonRes = await getTVSeasonDetails(Number(id), firstSeason);
            baseEpisodes = seasonRes.episodes || [];

            // Fetch links and extend episode list if DB has more links than TMDB
            const mediaRes = await getMediaLinks(Number(id), "tv", firstSeason);
            setMediaResult(mediaRes);
            setEpisodes(extendEpisodesWithDbLinks(baseEpisodes, mediaRes, Number(id), firstSeason));
          }
        }
      } catch (error) {
        console.error("Failed to fetch TV details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    if (!modal) window.scrollTo(0, 0);
  }, [id, blockedForUser, modal, fetchEntry]);

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
          const baseEpisodes: Episode[] = group.episodes.map((ep, index) => ({
            ...ep,
            episode_number: index + 1,
            season_number: partOrSeasonNumber,
          }));

          const mediaRes = await getMediaLinks(Number(id), "tv", partOrSeasonNumber);
          setMediaResult(mediaRes);
          setEpisodes(extendEpisodesWithDbLinks(baseEpisodes, mediaRes, Number(id), partOrSeasonNumber));
        }
      } else {
        // Use standard seasons - check database first
        const { data: storedEpisodes } = await supabase
          .from("entry_metadata")
          .select("*")
          .eq("entry_id", String(id))
          .eq("season_number", partOrSeasonNumber)
          .order("episode_number", { ascending: true });

        let baseEpisodes: Episode[];

        if (storedEpisodes && storedEpisodes.length > 0) {
          // Use stored episode data from database strictly
          baseEpisodes = storedEpisodes.map((ep) => ({
            id: ep.episode_number,
            name: ep.name || `Episode ${ep.episode_number}`,
            episode_number: ep.episode_number,
            season_number: ep.season_number,
            overview: ep.overview || "",
            still_path: ep.still_path,
            air_date: ep.air_date,
            runtime: ep.runtime,
            vote_average: ep.vote_average || 0,
          }));

          setEpisodes(baseEpisodes);
          const mediaRes = await getMediaLinks(Number(id), "tv", partOrSeasonNumber);
          setMediaResult(mediaRes);
        } else {
          // Fall back to TMDB
          const seasonRes = await getTVSeasonDetails(Number(id), partOrSeasonNumber);
          baseEpisodes = seasonRes.episodes || [];

          const mediaRes = await getMediaLinks(Number(id), "tv", partOrSeasonNumber);
          setMediaResult(mediaRes);
          setEpisodes(extendEpisodesWithDbLinks(baseEpisodes, mediaRes, Number(id), partOrSeasonNumber));
        }
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
        {/* Backdrop / trailer area skeleton */}
        <div className="relative h-[70vh] md:h-[calc(100vh-var(--app-header-offset))] md:min-h-[640px]">
          <Skeleton className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Content skeleton — matches TV details overlay layout */}
        <div className="container mx-auto px-4 md:px-0 relative z-10 -mt-44 md:details-overlap-desktop">
          <div className="max-w-xl lg:max-w-2xl md:px-8 lg:px-12">
            {/* Logo placeholder */}
            <Skeleton className="h-16 md:h-20 w-48 md:w-64 mb-3 md:mb-4 rounded-lg" />

            {/* Meta info chips */}
            <div className="flex items-center gap-2 mb-2 md:mb-4">
              <Skeleton className="h-6 w-14 rounded" />
              <Skeleton className="h-4 w-10 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>

            {/* Genre tags */}
            <div className="flex gap-2 mb-2 md:mb-4">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>

            {/* Overview text lines (hidden on mobile) */}
            <div className="hidden md:block space-y-2 mb-5">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>

            {/* Action buttons — real shapes */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 md:h-10 px-6 md:px-8 rounded-full bg-primary/20 flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary/30" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
              <div className="h-10 w-10 rounded-full bg-secondary/40" />
              <div className="h-10 w-10 rounded-full bg-secondary/40" />
            </div>

            {/* Season selector placeholder */}
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!show) {
    if (blockedForUser) {
      return (
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 pt-32 text-center">
            <h1 className="text-2xl font-bold mb-2">Not available</h1>
            <p className="text-muted-foreground mb-6">This content has been blocked by the administrator.</p>
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

    return (
      <div className="min-h-screen bg-background">
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



        {/* Hero Section - Full viewport height on desktop, shorter on mobile */}
        <div className="relative">
          <div
            ref={heroRef}
            className="relative h-[70vh] md:h-[calc(100vh-var(--app-header-offset))] md:min-h-[640px]"
          >
            {/* Background Trailer (hide when playing) */}
            {!playerState.isOpen ? (
              <BackgroundTrailer
                videoKey={trailerKey}
                backdropUrl={backdropUrl}
                title={title}
                controlsPlacement={modal ? "modal" : "page"}
              />
            ) : (
              <VideoPlayer
                tmdbId={Number(id)}
                type="tv"
                season={playerState.season}
                episode={playerState.episode}
                onClose={() => navigate(-1)}
                inline
                fill
                controlsPlacement={modal ? "modal" : "page"}
                className=""
                title={show?.name}
                posterPath={show?.poster_path}
                style={{
                  ["--reveal-x" as any]: revealOrigin ? `${revealOrigin.x}px` : "18%",
                  ["--reveal-y" as any]: revealOrigin ? `${revealOrigin.y}px` : "85%",
                }}
              />
            )}

            {/* Readability overlays (disabled while playing so iframe controls stay clear) */}
            {!playerState.isOpen && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent pointer-events-none" />
              </>
            )}
          </div>

          {/* Details block (animates below player; overlays trailer when not playing) */}
          <div
            className={
              "container mx-auto px-4 md:px-0 relative z-10 transform-gpu will-change-transform " +
              (modal ? "" : "") +
              // IMPORTANT: avoid translateY when player is open (transforms don't take layout space and can overlap the Actors section)
              (playerState.isOpen ? "mt-6 md:mt-10" : "-mt-44 md:details-overlap-desktop")
            }
          >
            <div
              className={
                (modal ? "" : "") +
                "max-w-xl lg:max-w-2xl md:px-8 lg:px-12 " +
                (playerState.isOpen
                  ? "rounded-2xl bg-card/80 backdrop-blur-xl border border-border p-4 md:p-0 md:bg-transparent md:border-0 md:backdrop-blur-none"
                  : "")
              }
            >
              {/* Logo */}
              {logoUrl ? (
                <img src={logoUrl} alt={title} className="h-16 md:h-20 lg:h-24 object-contain object-left mb-3 md:mb-4" />
              ) : (
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4 leading-tight">{title}</h1>
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
                {imdbId && (
                  <>
                    <span className="text-muted-foreground text-[10px] md:text-sm">•</span>
                    <a
                      href={`https://www.imdb.com/title/${imdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] md:text-sm text-yellow-500 hover:text-yellow-400 transition-colors"
                    >
                      <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      <span className="font-medium">IMDb</span>
                    </a>
                  </>
                )}
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
              <p className="hidden md:block text-muted-foreground text-sm md:text-base mb-5 line-clamp-3">{show.overview}</p>

              {/* Action buttons */}
              <div className="flex items-center gap-3 md:gap-3">
                <AnimatedPlayButton
                  ref={playButtonRef}
                  className="h-11 md:h-10 px-6 md:px-8 shadow-glow"
                  onClick={() => {
                    const heroRect = heroRef.current?.getBoundingClientRect();
                    const btnRect = playButtonRef.current?.getBoundingClientRect();
                    if (heroRect && btnRect) {
                      setRevealOrigin({
                        x: btnRect.left + btnRect.width / 2 - heroRect.left,
                        y: btnRect.top + btnRect.height / 2 - heroRect.top,
                      });
                    } else {
                      setRevealOrigin(null);
                    }

                    // Instant scroll (override global scroll-behavior: smooth)
                    const root = document.documentElement;
                    const prev = root.style.scrollBehavior;
                    root.style.scrollBehavior = "auto";
                    window.scrollTo({ top: 0, left: 0 });
                    requestAnimationFrame(() => {
                      root.style.scrollBehavior = prev;
                    });

                    // Add watch params to URL - this creates a history entry
                    const params = new URLSearchParams(location.search);
                    params.set("watch", "1");
                    params.set("s", String(selectedSeason));
                    params.set("e", "1");
                    navigate({ search: params.toString() });
                  }}
                />
                <button
                  type="button"
                  className={
                    "relative flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-full bg-secondary/50 border border-border backdrop-blur-sm transition-all duration-150 hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (displayedInWatchlist ? "text-primary border-primary bg-primary/20 " : "text-foreground ") +
                    (watchlistAnim === "add" ? "bookmark-burst " : "") +
                    (watchlistAnim === "remove" ? "bookmark-unburst " : "")
                  }
                  onClick={async () => {
                    if (!show || isBookmarking) return;

                    const next = !displayedInWatchlist;
                    setOptimisticInWatchlist(next);

                    setWatchlistAnim(next ? "add" : "remove");
                    window.setTimeout(() => setWatchlistAnim(null), 400);

                    setIsBookmarking(true);
                    const showData: Movie = {
                      id: show.id,
                      title: show.name || "",
                      name: show.name,
                      overview: show.overview,
                      poster_path: show.poster_path,
                      backdrop_path: show.backdrop_path,
                      vote_average: show.vote_average,
                      first_air_date: show.first_air_date,
                      genre_ids: show.genres?.map((g) => g.id) || [],
                      media_type: "tv",
                    };
                    await toggleWatchlist(showData);
                    setIsBookmarking(false);
                  }}
                  aria-label={displayedInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                  title={displayedInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                >
                  {isBookmarking ? (
                    <Loader2 className="w-5 h-5 md:w-4 md:h-4 animate-spin" />
                  ) : (
                    <Bookmark
                      className={
                        "w-5 h-5 md:w-4 md:h-4 transition-all duration-150 " +
                        (watchlistAnim === "add" ? "bookmark-pop " : "") +
                        (watchlistAnim === "remove" ? "bookmark-unpop " : "") +
                        (displayedInWatchlist
                          ? "fill-primary scale-110"
                          : "fill-transparent scale-100")
                      }
                    />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Episodes / Similars Section - closer to hero on mobile */}
        <section className="py-3 md:py-10 mt-6 md:mt-0">
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
                        isActive={
                          playerState.isOpen &&
                          playerState.season === selectedSeason &&
                          playerState.episode === episode.episode_number
                        }
                        onClick={() => {
                          // Instant scroll (override global scroll-behavior: smooth)
                          const root = document.documentElement;
                          const prev = root.style.scrollBehavior;
                          root.style.scrollBehavior = "auto";
                          window.scrollTo({ top: 0, left: 0 });
                          requestAnimationFrame(() => {
                            root.style.scrollBehavior = prev;
                          });

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
                      <MovieCard
                        key={item.id}
                        movie={{ ...item, media_type: "tv" }}
                        size="sm"
                        enableReveal={false}
                        enableHoverPortal={false}
                        hoverCharacterMode="contained"
                      />
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
