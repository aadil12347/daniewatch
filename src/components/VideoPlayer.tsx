import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMediaLinks, MediaLinkResult } from "@/lib/mediaLinks";
import { useMedia } from "@/contexts/MediaContext";

interface VideoPlayerProps {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  onClose: () => void;
  inline?: boolean;
}

export const VideoPlayer = ({ tmdbId, type, season = 1, episode = 1, onClose, inline = false }: VideoPlayerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [mediaResult, setMediaResult] = useState<MediaLinkResult | null>(null);
  const { setIsVideoPlaying } = useMedia();

  // Check for video sources with priority: Supabase -> Blogger -> Videasy
  useEffect(() => {
    const fetchMediaLinks = async () => {
      setIsLoading(true);
      const result = await getMediaLinks(tmdbId, type, season, episode);
      setMediaResult(result);
      setIsLoading(false);
    };
    
    fetchMediaLinks();
  }, [tmdbId, type, season, episode]);

  // Get the embed URL from media result
  const getEmbedUrl = () => {
    if (!mediaResult) {
      // Fallback while loading
      if (type === "movie") {
        return `https://player.videasy.net/movie/${tmdbId}`;
      } else {
        return `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
      }
    }

    // For TV shows, check seasonEpisodeLinks first
    if (type === "tv" && mediaResult.seasonEpisodeLinks && episode) {
      const episodeLink = mediaResult.seasonEpisodeLinks[episode - 1];
      if (episodeLink) {
        console.log(`[VideoPlayer] Using ${mediaResult.source} episode link for S${season}E${episode}:`, episodeLink);
        return episodeLink;
      }
    }

    // Use watchUrl if available
    if (mediaResult.watchUrl) {
      console.log(`[VideoPlayer] Using ${mediaResult.source} watch URL:`, mediaResult.watchUrl);
      return mediaResult.watchUrl;
    }

    // Final fallback
    if (type === "movie") {
      return `https://player.videasy.net/movie/${tmdbId}`;
    } else {
      return `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
    }
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

  // Set video playing state in context
  useEffect(() => {
    setIsVideoPlaying(true);
    return () => setIsVideoPlaying(false);
  }, [setIsVideoPlaying]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
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

  // Inline mode: fills parent container (hero section size) with high z-index above navbar
  // Fullscreen mode: fixed overlay covering entire viewport
  const containerClasses = inline
    ? "absolute inset-0 w-full h-full z-[70] bg-black"
    : "fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] bg-black";

  const containerStyle = inline
    ? undefined
    : { position: 'fixed' as const, width: '100vw', height: '100vh', top: 0, left: 0 };

  return (
    <div
      className={containerClasses}
      style={containerStyle}
    >
      {/* Close button - only show in inline mode, player has its own controls */}
      {inline && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-20 md:top-24 z-[80] right-4 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white pointer-events-auto"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      )}

      {/* Simple loading spinner while checking for video source */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Video iframe - show immediately when ready */}
      {!isLoading && (
        <iframe
          src={getEmbedUrl()}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        />
      )}
    </div>
  );
};