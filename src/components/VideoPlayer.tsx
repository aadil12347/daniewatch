import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

function getVideasyEmbedUrl(tmdbId: number, type: "movie" | "tv", season: number, episode: number) {
  if (type === "movie") return `https://player.videasy.net/movie/${tmdbId}`;
  return `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
}

function getMoviesApiEmbedUrl(tmdbId: number, type: "movie" | "tv", season: number, episode: number) {
  if (type === "movie") return `https://moviesapi.club/movie/${tmdbId}`;
  return `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`;
}

export const VideoPlayer = ({ tmdbId, type, season = 1, episode = 1, onClose, inline = false, fill = false, className }: VideoPlayerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [mediaResult, setMediaResult] = useState<MediaLinkResult | null>(null);
  const [useAlternate, setUseAlternate] = useState(false);

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

      // Workaround: MoviesAPI blocks Lovable's sandboxed preview iframe.
      // In preview only, switch to Videasy automatically.
      if (isSandboxed && result.source === "moviesapi") {
        setUseAlternate(true);
      }

      setIsLoading(false);
    };

    fetchMediaLinks();
  }, [tmdbId, type, season, episode, isSandboxed]);

  const getEmbedUrl = () => {
    if (!mediaResult) return moviesApiUrl;

    // Manual alternate player switch (MoviesAPI -> Videasy)
    if (mediaResult.source === "moviesapi" && useAlternate) return videasyUrl;

    // For TV shows, check seasonEpisodeLinks first (Cloud DB)
    if (type === "tv" && mediaResult.seasonEpisodeLinks && episode) {
      const episodeLink = mediaResult.seasonEpisodeLinks[episode - 1];
      if (episodeLink) return episodeLink;
    }

    if (mediaResult.watchUrl) return mediaResult.watchUrl;

    return moviesApiUrl;
  };

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

  const showSwitch = !isLoading && mediaResult?.source === "moviesapi";

  // Desktop: keep it hidden until hover/focus (feels like video controls)
  // Mobile: always visible (no hover)
  const switchVisibilityClass = isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100";

  return (
    <TooltipProvider>
      <div className={"group " + containerClasses + (className ? " " + className : "")} style={containerStyle}>
        {/* Close button: desktop only */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-[80] w-10 h-10 rounded-full bg-background/20 hover:bg-background/30 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
            aria-label="Close player"
          >
            <X className="w-5 h-5" />
          </Button>
        )}

        {/* Compact switch player button */}
        {showSwitch && (
          <div className={"absolute top-2 left-2 z-[80] pointer-events-auto transition-opacity " + switchVisibilityClass}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 md:h-10 md:w-10 bg-background/20 hover:bg-background/30 backdrop-blur-sm"
                  onClick={() => setUseAlternate((v) => !v)}
                  aria-label="Switch player"
                >
                  <ArrowLeftRight className={"h-4 w-4 transition-transform " + (useAlternate ? "rotate-180" : "rotate-0")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                {useAlternate ? "Switch to MoviesAPI" : "Switch to Videasy"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && (
          <iframe
            src={getEmbedUrl()}
            title="Video player"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          />
        )}
      </div>
    </TooltipProvider>
  );
};
