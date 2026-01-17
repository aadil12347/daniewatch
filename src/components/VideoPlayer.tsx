import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMedia } from "@/contexts/MediaContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMediaLinks, MediaLinkResult } from "@/lib/mediaLinks";

interface VideoPlayerProps {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  onClose: () => void;
  /**
   * When true, render as an embedded (non-fullscreen) player.
   * When false, render as a fullscreen overlay.
   */
  inline?: boolean;
  /**
   * When true (and inline), fill the parent container (useful for hero overlays).
   */
  fill?: boolean;
  /**
   * Optional extra classes for the outer container.
   */
  className?: string;
  /**
   * Optional inline styles for the outer container (used for CSS variables like splash origin).
   */
  style?: CSSProperties;
}

function getVideasyEmbedUrl(tmdbId: number, type: "movie" | "tv", season: number, episode: number) {
  if (type === "movie") return `https://player.videasy.net/movie/${tmdbId}`;
  return `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
}

function getMoviesApiEmbedUrl(tmdbId: number, type: "movie" | "tv", season: number, episode: number) {
  if (type === "movie") return `https://moviesapi.club/movie/${tmdbId}`;
  return `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`;
}

function PlayerLoader() {
  return (
    <div className="player-iframe-loader" aria-label="Loading video" role="status">
      <div className="loader">
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle r="32" cy="40" cx="40" />
        </svg>
      </div>

      <div className="loader triangle" aria-hidden="true">
        <svg viewBox="0 0 86 80">
          <polygon points="43 8 79 72 7 72" />
        </svg>
      </div>

      <div className="loader" aria-hidden="true">
        <svg viewBox="0 0 80 80">
          <rect height="64" width="64" y="8" x="8" />
        </svg>
      </div>
    </div>
  );
}

export const VideoPlayer = ({
  tmdbId,
  type,
  season = 1,
  episode = 1,
  onClose,
  inline = false,
  fill = false,
  className,
  style,
}: VideoPlayerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [mediaResult, setMediaResult] = useState<MediaLinkResult | null>(null);
  const [useAlternate, setUseAlternate] = useState(false);
  const [confirmSwitchOpen, setConfirmSwitchOpen] = useState(false);

  const { setIsVideoPlaying } = useMedia();
  const isMobile = useIsMobile();

  const isSandboxed = useMemo(() => {
    // In Lovable preview, the app runs inside a sandboxed iframe.
    // Some providers block embedding in sandboxed iframes.
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const moviesApiUrl = useMemo(() => getMoviesApiEmbedUrl(tmdbId, type, season, episode), [tmdbId, type, season, episode]);
  const videasyUrl = useMemo(() => getVideasyEmbedUrl(tmdbId, type, season, episode), [tmdbId, type, season, episode]);

  useEffect(() => {
    const fetchMediaLinks = async () => {
      setIsLoading(true);
      setUseAlternate(false);

      const result = await getMediaLinks(tmdbId, type, season, episode);
      setMediaResult(result);

      // If the primary provider is blocked in preview, allow the user to switch.
      // (We keep this lightweight; Videasy is now default, but user may switch.)
      if (isSandboxed && result.source === "moviesapi") {
        setUseAlternate(true);
      }

      setIsLoading(false);
    };

    fetchMediaLinks();
  }, [tmdbId, type, season, episode, isSandboxed]);

  const embedUrl = useMemo(() => {
    // Default to Videasy if we don't have a lookup result yet.
    if (!mediaResult) return videasyUrl;

    // Manual alternate player switch
    if (mediaResult.source === "videasy" && useAlternate) return moviesApiUrl;
    if (mediaResult.source === "moviesapi" && useAlternate) return videasyUrl;

    // For TV shows, check seasonEpisodeLinks first (Cloud DB)
    if (type === "tv" && mediaResult.seasonEpisodeLinks && episode) {
      const episodeLink = mediaResult.seasonEpisodeLinks[episode - 1];
      if (episodeLink) return episodeLink;
    }

    if (mediaResult.watchUrl) return mediaResult.watchUrl;

    return videasyUrl;
  }, [episode, mediaResult, moviesApiUrl, type, useAlternate, videasyUrl]);

  // Whenever the iframe src changes, show the loader until the iframe finishes loading.
  useEffect(() => {
    setIsIframeLoading(true);
  }, [embedUrl]);

  // Listen for player events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === "string") {
          const data = JSON.parse(event.data);
          if (data.type === "PLAYER_EVENT") {
            console.log("Player event:", data.data);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    setIsVideoPlaying(true);
    return () => setIsVideoPlaying(false);
  }, [setIsVideoPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    if (!inline) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (!inline) {
        document.body.style.overflow = "";
      }
    };
  }, [inline, onClose]);

  const containerClasses = inline
    ? fill
      ? "absolute inset-0 w-full h-full bg-background overflow-hidden"
      : "relative w-full aspect-video bg-background overflow-hidden"
    : "fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] bg-background";

  const containerStyle = inline ? undefined : ({ position: "fixed" as const, width: "100vw", height: "100vh", top: 0, left: 0 } as const);
  const mergedStyle = { ...(containerStyle ?? {}), ...(style ?? {}) } as CSSProperties;

  // Only offer switching when we're not using a Cloud DB embed (supabase).
  const showSwitch = !isLoading && !!mediaResult && mediaResult.source !== "supabase";

  // Desktop: keep it hidden until hover/focus (feels like video controls)
  // Mobile: always visible (no hover)
  const switchVisibilityClass = isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100";

  const primaryIsVideasy = (mediaResult?.source ?? "videasy") === "videasy";
  const isShowingAlternate = useAlternate;

  const nextLabel = primaryIsVideasy
    ? isShowingAlternate
      ? "Switch to Videasy"
      : "Switch to MoviesAPI"
    : isShowingAlternate
      ? "Switch to MoviesAPI"
      : "Switch to Videasy";

  const requestSwitch = () => {
    if (!isMobile) {
      setUseAlternate((v) => !v);
      return;
    }
    setConfirmSwitchOpen(true);
  };

  const confirmSwitch = () => {
    setUseAlternate((v) => !v);
    setConfirmSwitchOpen(false);
  };

  const showLoaderOverlay = isLoading || isIframeLoading;

  return (
    <TooltipProvider>
      <div className={"group " + containerClasses + (className ? " " + className : "")} style={mergedStyle}>
        {/* Mobile-only confirm */}
        <AlertDialog open={confirmSwitchOpen} onOpenChange={setConfirmSwitchOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Switch player?</AlertDialogTitle>
              <AlertDialogDescription>This will reload the video using the other source.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmSwitch}>Switch</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Compact switch player button */}
        {showSwitch && (
          <div className={"absolute bottom-3 left-3 md:bottom-4 md:left-4 z-[80] pointer-events-auto transition-opacity " + switchVisibilityClass}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 md:h-10 md:w-10 bg-background/20 hover:bg-background/30 backdrop-blur-sm"
                  onClick={requestSwitch}
                  aria-label="Switch player"
                >
                  <ArrowLeftRight className={"h-4 w-4 transition-transform " + (useAlternate ? "rotate-180" : "rotate-0")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                {nextLabel}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Iframe is always mounted once link lookup is done; we show loader until onLoad fires */}
        {!isLoading && (
          <iframe
            key={embedUrl}
            src={embedUrl}
            title="Video player"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            onLoad={() => setIsIframeLoading(false)}
          />
        )}

        {showLoaderOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-[70]">
            <PlayerLoader />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

