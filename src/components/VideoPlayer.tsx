import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoPlayerProps {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  language?: string;
  onClose: () => void;
}

export const VideoPlayer = ({ tmdbId, type, season = 1, episode = 1, language = "hi", onClose }: VideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the VidSrc embed URL with language support
  const getEmbedUrl = () => {
    const baseUrl = "https://vidsrc-embed.ru/embed";
    
    if (type === "movie") {
      return `${baseUrl}/movie?tmdb=${tmdbId}&ds_lang=${language}&autoplay=1`;
    } else {
      return `${baseUrl}/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}&ds_lang=${language}&autoplay=1&autonext=1`;
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
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-[10000] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Video iframe - True full screen */}
      <iframe
        src={getEmbedUrl()}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      />
    </div>
  );
};
