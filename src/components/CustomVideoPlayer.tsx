import { useState, useRef, useEffect, forwardRef } from "react";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Subtitles,
  Languages,
  ChevronLeft,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface CustomVideoPlayerProps {
  embedUrl: string;
  title?: string;
  onBack: () => void;
  onClose: () => void;
}

const CustomVideoPlayer = forwardRef<HTMLDivElement, CustomVideoPlayerProps>(
  ({ embedUrl, title, onBack, onClose }, ref) => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [selectedQuality, setSelectedQuality] = useState("Auto");
    const [selectedSubtitle, setSelectedSubtitle] = useState("Off");
    const [selectedLanguage, setSelectedLanguage] = useState("English");
    
    const containerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const qualities = ["Auto", "1080p", "720p", "480p", "360p"];
    const subtitles = ["Off", "English", "Spanish", "French", "German", "Arabic"];
    const languages = ["English", "Spanish", "French", "German", "Arabic", "Hindi"];
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    // Auto-hide controls
    useEffect(() => {
      const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
          if (isPlaying) {
            setShowControls(false);
          }
        }, 3000);
      };

      const container = containerRef.current;
      if (container) {
        container.addEventListener("mousemove", handleMouseMove);
        container.addEventListener("touchstart", handleMouseMove);
      }

      return () => {
        if (container) {
          container.removeEventListener("mousemove", handleMouseMove);
          container.removeEventListener("touchstart", handleMouseMove);
        }
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      };
    }, [isPlaying]);

    // Fullscreen handling
    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    };

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
          case " ":
          case "k":
            e.preventDefault();
            setIsPlaying(prev => !prev);
            break;
          case "m":
            e.preventDefault();
            setIsMuted(prev => !prev);
            break;
          case "f":
            e.preventDefault();
            toggleFullscreen();
            break;
          case "Escape":
            e.preventDefault();
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              onBack();
            }
            break;
          case "ArrowUp":
            e.preventDefault();
            setVolume(prev => Math.min(100, prev + 10));
            break;
          case "ArrowDown":
            e.preventDefault();
            setVolume(prev => Math.max(0, prev - 10));
            break;
        }
      };

      window.addEventListener("keydown", handleKeyDown, true);
      return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [onBack]);

    const formatTime = (time: number) => {
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = Math.floor(time % 60);
      
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      }
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full bg-black group"
      >
        {/* Video iframe */}
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          style={{ border: "none" }}
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        />

        {/* Gradient overlay for controls visibility */}
        <div 
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Top gradient */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />
        </div>

        {/* Top controls */}
        <div 
          className={cn(
            "absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-50 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
              onClick={onBack}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            {title && (
              <h2 className="text-white text-lg font-medium truncate max-w-[50vw]">
                {title}
              </h2>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Center play/pause button */}
        <div 
          className={cn(
            "absolute inset-0 flex items-center justify-center z-40 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="w-20 h-20 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white hover:scale-110 transition-transform"
            onClick={() => setIsPlaying(prev => !prev)}
          >
            {isPlaying ? (
              <Pause className="w-10 h-10" />
            ) : (
              <Play className="w-10 h-10 ml-1" />
            )}
          </Button>
        </div>

        {/* Bottom controls */}
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 p-4 z-50 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Progress bar */}
          <div className="mb-4 px-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              className="cursor-pointer"
              onValueChange={(value) => setCurrentTime(value[0])}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            {/* Left controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 text-white hover:bg-white/20"
                onClick={() => setIsPlaying(prev => !prev)}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 text-white hover:bg-white/20"
              >
                <SkipBack className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 text-white hover:bg-white/20"
              >
                <SkipForward className="w-5 h-5" />
              </Button>

              {/* Volume */}
              <div className="flex items-center gap-2 group/volume">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 text-white hover:bg-white/20"
                  onClick={() => setIsMuted(prev => !prev)}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>
                <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={100}
                    step={1}
                    className="cursor-pointer"
                    onValueChange={(value) => {
                      setVolume(value[0]);
                      setIsMuted(value[0] === 0);
                    }}
                  />
                </div>
              </div>

              {/* Time */}
              <span className="text-white text-sm ml-2">
                {formatTime(currentTime)} / {formatTime(duration || 5400)}
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1">
              {/* Subtitles */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "w-10 h-10 text-white hover:bg-white/20",
                      selectedSubtitle !== "Off" && "text-primary"
                    )}
                  >
                    <Subtitles className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-black/90 border-white/20 text-white min-w-[150px]">
                  <DropdownMenuLabel>Subtitles</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/20" />
                  {subtitles.map((sub) => (
                    <DropdownMenuItem
                      key={sub}
                      className={cn(
                        "cursor-pointer hover:bg-white/20",
                        selectedSubtitle === sub && "bg-white/10"
                      )}
                      onClick={() => setSelectedSubtitle(sub)}
                    >
                      {sub}
                      {selectedSubtitle === sub && " ✓"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Language */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 text-white hover:bg-white/20"
                  >
                    <Languages className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-black/90 border-white/20 text-white min-w-[150px]">
                  <DropdownMenuLabel>Audio Language</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/20" />
                  {languages.map((lang) => (
                    <DropdownMenuItem
                      key={lang}
                      className={cn(
                        "cursor-pointer hover:bg-white/20",
                        selectedLanguage === lang && "bg-white/10"
                      )}
                      onClick={() => setSelectedLanguage(lang)}
                    >
                      {lang}
                      {selectedLanguage === lang && " ✓"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Quality */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 px-3 text-white hover:bg-white/20 text-sm font-medium"
                  >
                    {selectedQuality}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-black/90 border-white/20 text-white min-w-[120px]">
                  <DropdownMenuLabel>Quality</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/20" />
                  {qualities.map((quality) => (
                    <DropdownMenuItem
                      key={quality}
                      className={cn(
                        "cursor-pointer hover:bg-white/20",
                        selectedQuality === quality && "bg-white/10"
                      )}
                      onClick={() => setSelectedQuality(quality)}
                    >
                      {quality}
                      {selectedQuality === quality && " ✓"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Playback Speed */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 px-3 text-white hover:bg-white/20 text-sm font-medium"
                  >
                    {playbackSpeed}x
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-black/90 border-white/20 text-white min-w-[100px]">
                  <DropdownMenuLabel>Speed</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/20" />
                  {speeds.map((speed) => (
                    <DropdownMenuItem
                      key={speed}
                      className={cn(
                        "cursor-pointer hover:bg-white/20",
                        playbackSpeed === speed && "bg-white/10"
                      )}
                      onClick={() => setPlaybackSpeed(speed)}
                    >
                      {speed}x
                      {playbackSpeed === speed && " ✓"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Settings */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 text-white hover:bg-white/20"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-black/90 border-white/20 text-white min-w-[180px]">
                  <DropdownMenuLabel>Settings</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/20" />
                  <DropdownMenuItem className="cursor-pointer hover:bg-white/20">
                    Playback Speed: {playbackSpeed}x
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-white/20">
                    Quality: {selectedQuality}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-white/20">
                    Subtitles: {selectedSubtitle}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-white/20">
                    Audio: {selectedLanguage}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Fullscreen */}
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 text-white hover:bg-white/20"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div 
          className={cn(
            "absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg text-white text-sm transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="opacity-60">
            Space/K: Play/Pause • M: Mute • F: Fullscreen • Esc: Exit
          </span>
        </div>
      </div>
    );
  }
);

CustomVideoPlayer.displayName = "CustomVideoPlayer";

export default CustomVideoPlayer;
