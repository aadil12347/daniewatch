import { useEffect, useRef, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchBloggerForTmdbId, triggerDownload, BloggerVideoResult } from "@/lib/blogger";

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

  // Check Blogger for video first
  useEffect(() => {
    const checkBlogger = async () => {
      setIsLoading(true);
      const result = await searchBloggerForTmdbId(tmdbId, type, season);
      setBloggerResult(result);
      setIsLoading(false);
    };
    
    checkBlogger();
  }, [tmdbId, type, season]);

  // Handle download click
  const handleDownload = () => {
    if (bloggerResult?.downloadLink) {
      const filename = type === "movie" 
        ? `movie_${tmdbId}.mp4`
        : `tv_${tmdbId}_S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}.mp4`;
      triggerDownload(bloggerResult.downloadLink, filename);
    }
  };

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

  // Get the embed URL (Blogger iframe or VidKing fallback)
  const getEmbedUrl = () => {
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

      {/* Download button if available */}
      {bloggerResult?.downloadLink && (
        <button
          onClick={handleDownload}
          className="absolute top-4 right-16 z-[10000] flex items-center gap-2 px-4 py-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      )}

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
