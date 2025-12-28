import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackgroundTrailerProps {
  videoKey: string | null;
  backdropUrl: string | null;
  title: string;
}

export const BackgroundTrailer = ({ videoKey, backdropUrl, title }: BackgroundTrailerProps) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // YouTube embed URL with autoplay, mute, and loop
  const embedUrl = videoKey
    ? `https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=1&loop=1&playlist=${videoKey}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${window.location.origin}`
    : null;

  const toggleMute = () => {
    if (iframeRef.current?.contentWindow) {
      const command = isMuted ? "unMute" : "mute";
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: command }),
        "*"
      );
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="absolute inset-0">
      {/* Fallback backdrop image */}
      {backdropUrl && (
        <img
          src={backdropUrl}
          alt={title}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-1000",
            isVideoLoaded && videoKey ? "opacity-0" : "opacity-100"
          )}
        />
      )}

      {/* YouTube video background */}
      {embedUrl && (
        <div className="absolute inset-0 overflow-hidden">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={`${title} Trailer`}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] pointer-events-none"
            style={{ border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            onLoad={() => setIsVideoLoaded(true)}
          />
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />

      {/* Volume control button - top right */}
      {videoKey && (
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleMute}
          className="absolute top-20 right-6 z-20 w-10 h-10 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 hover:bg-background/80 transition-all duration-300"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </Button>
      )}
    </div>
  );
};
