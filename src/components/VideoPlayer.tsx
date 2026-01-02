import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchBloggerForTmdbId, BloggerVideoResult } from "@/lib/blogger";
import { useMedia } from "@/contexts/MediaContext";

interface VideoPlayerProps {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  onClose: () => void;
}

export const VideoPlayer = ({ tmdbId, type, season = 1, episode = 1, onClose }: VideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bloggerResult, setBloggerResult] = useState<BloggerVideoResult | null>(null);
  const { setIsVideoPlaying } = useMedia();

  // Check Blogger for video first
  useEffect(() => {
    const checkBlogger = async () => {
      setIsLoading(true);
      const result = await searchBloggerForTmdbId(tmdbId, type, season, episode);
      setBloggerResult(result);
      setIsLoading(false);
    };
    
    checkBlogger();
  }, [tmdbId, type, season, episode]);

  // Build the VidKing embed URL (fallback)
  const getVidKingUrl = () => {
    const baseUrl = "https://www.vidking.net/embed";
    const params = new URLSearchParams({
      color: "dc2626",
      autoPlay: "true",
    });

    if (type === "movie") {
      return `${baseUrl}/movie/${tmdbId}?${params.toString()}`;
    } else {
      params.append("nextEpisode", "true");
      params.append("episodeSelector", "true");
      return `${baseUrl}/tv/${tmdbId}/${season}/${episode}?${params.toString()}`;
    }
  };

  // Get the embed URL (Blogger watch link or VidKing fallback)
  const getEmbedUrl = () => {
    // For TV shows, check seasonEpisodeLinks first (links containing "byse")
    if (type === "tv" && bloggerResult?.seasonEpisodeLinks && episode) {
      const episodeLink = bloggerResult.seasonEpisodeLinks[episode - 1];
      if (episodeLink) {
        console.log(`Using Blogger episode link for S${season}E${episode}:`, episodeLink);
        return episodeLink;
      }
    }
    // Also check iframeSrc for backwards compatibility
    if (bloggerResult?.found && bloggerResult.iframeSrc) {
      return bloggerResult.iframeSrc;
    }
    return getVidKingUrl();
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

  // Handle browser back button - close video instead of navigating
  useEffect(() => {
    // Push a state to history when video opens
    window.history.pushState({ videoPlayer: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      // Close the video player instead of navigating back
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] bg-black"
      style={{ position: 'fixed', width: '100vw', height: '100vh', top: 0, left: 0 }}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      )}

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-[10000] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Video iframe */}
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
