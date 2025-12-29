import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomVideoPlayerProps {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  onClose: () => void;
}

export const CustomVideoPlayer = ({
  tmdbId,
  type,
  season = 1,
  episode = 1,
  onClose,
}: CustomVideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the VidKing embed URL
  const getEmbedUrl = () => {
    const baseUrl = "https://www.vidking.net/embed";
    
    if (type === "movie") {
      return `${baseUrl}/movie/${tmdbId}?autoPlay=true&nextEpisode=true&episodeSelector=true`;
    } else {
      return `${baseUrl}/tv/${tmdbId}?autoPlay=true&nextEpisode=true&episodeSelector=true&season=${season}&episode=${episode}`;
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll when player is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      ref={containerRef}
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-[10000] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </Button>

      {/* VidKing Player Iframe */}
      <iframe
        src={getEmbedUrl()}
        className="w-full h-full"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        style={{ border: "none" }}
      />
    </div>
  );
};
