import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface BackgroundTrailerProps {
  videoKey: string | null;
  backdropUrl: string | null;
  title: string;
}

export const BackgroundTrailer = ({ videoKey, backdropUrl, title }: BackgroundTrailerProps) => {
  const [volume, setVolume] = useState(0);
  const [previousVolume, setPreviousVolume] = useState(50);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  // YouTube embed URL with autoplay, mute, and loop
  const embedUrl = videoKey
    ? `https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=1&loop=1&playlist=${videoKey}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${window.location.origin}`
    : null;

  const sendYouTubeCommand = (func: string, args?: number) => {
    if (iframeRef.current?.contentWindow) {
      const message = args !== undefined
        ? JSON.stringify({ event: "command", func, args: [args] })
        : JSON.stringify({ event: "command", func });
      iframeRef.current.contentWindow.postMessage(message, "*");
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    
    if (newVolume === 0) {
      sendYouTubeCommand("mute");
    } else {
      sendYouTubeCommand("unMute");
      sendYouTubeCommand("setVolume", newVolume);
    }
  };

  const toggleMute = () => {
    if (volume > 0) {
      setPreviousVolume(volume);
      handleVolumeChange([0]);
    } else {
      handleVolumeChange([previousVolume || 50]);
    }
  };

  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  // Close slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(event.target as Node)) {
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

      {/* Volume control - top right */}
      {videoKey && (
        <div 
          ref={controlsRef}
          className="absolute top-20 right-6 z-20 flex items-center gap-3"
        >
          {/* Volume slider */}
          <div 
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 transition-all duration-300",
              showVolumeSlider 
                ? "opacity-100 translate-x-0" 
                : "opacity-0 translate-x-4 pointer-events-none"
            )}
          >
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">
              {volume}%
            </span>
          </div>

          {/* Volume button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (showVolumeSlider) {
                toggleMute();
              } else {
                setShowVolumeSlider(true);
              }
            }}
            onDoubleClick={toggleMute}
            className="w-10 h-10 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 hover:bg-background/80 transition-all duration-300"
          >
            <VolumeIcon className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
};
