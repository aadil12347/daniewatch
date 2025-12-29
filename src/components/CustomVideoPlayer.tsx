import { useState, useEffect, useRef } from "react";
import { X, Globe, ChevronDown, Play, Maximize, Minimize, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CustomVideoPlayerProps {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  onClose: () => void;
}

const LANGUAGES = [
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ta", name: "Tamil", flag: "🇮🇳" },
  { code: "te", name: "Telugu", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", flag: "🇮🇳" },
  { code: "bn", name: "Bengali", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", flag: "🇮🇳" },
  { code: "kn", name: "Kannada", flag: "🇮🇳" },
  { code: "pa", name: "Punjabi", flag: "🇮🇳" },
];

export const CustomVideoPlayer = ({ 
  tmdbId, 
  type, 
  season = 1, 
  episode = 1, 
  onClose 
}: CustomVideoPlayerProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]); // Hindi default
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Build the VidSrc embed URL with language
  const getEmbedUrl = () => {
    const baseUrl = "https://vidsrc-embed.ru/embed";
    
    if (type === "movie") {
      return `${baseUrl}/movie?tmdb=${tmdbId}&ds_lang=${selectedLanguage.code}&autoplay=1`;
    } else {
      return `${baseUrl}/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}&ds_lang=${selectedLanguage.code}&autoplay=1&autonext=1`;
    }
  };

  // Build the download URL (same as embed but triggers download)
  const getDownloadUrl = () => {
    const baseUrl = "https://vidsrc-embed.ru/embed";
    
    if (type === "movie") {
      return `${baseUrl}/movie?tmdb=${tmdbId}&ds_lang=${selectedLanguage.code}`;
    } else {
      return `${baseUrl}/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}&ds_lang=${selectedLanguage.code}`;
    }
  };

  const handleDownload = () => {
    const downloadUrl = getDownloadUrl();
    // Open in new tab - user can use browser's download functionality
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.download = type === 'movie' ? `movie-${tmdbId}.mp4` : `tv-${tmdbId}-S${season}E${episode}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, isFullscreen]);

  // Auto-hide controls
  useEffect(() => {
    if (isPlaying && showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handleLanguageChange = (lang: typeof LANGUAGES[0]) => {
    setSelectedLanguage(lang);
    // If already playing, this will reload with new language
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black"
      onMouseMove={handleMouseMove}
      onClick={() => setShowControls(true)}
    >
      {/* Top Controls Bar */}
      <div 
        className={`absolute top-0 left-0 right-0 z-[10001] bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>

          {/* Title & Language Selector */}
          <div className="flex items-center gap-4">
            {/* Language Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-lg mr-1">{selectedLanguage.flag}</span>
                  <span>{selectedLanguage.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="bg-zinc-900 border-zinc-700 z-[10002] max-h-[300px] overflow-y-auto"
                align="end"
              >
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    className={`flex items-center gap-3 cursor-pointer text-white hover:bg-zinc-800 ${
                      selectedLanguage.code === lang.code ? 'bg-zinc-800' : ''
                    }`}
                    onClick={() => handleLanguageChange(lang)}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
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

      {/* Video Player Area */}
      {!isPlaying ? (
        /* Pre-play Screen with Language Selection */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
          <div className="text-center space-y-8">
            <h2 className="text-2xl font-bold text-white">Select Language & Play</h2>
            
            {/* Language Selection Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-w-2xl mx-auto px-4">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                    selectedLanguage.code === lang.code
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-black'
                      : 'bg-zinc-800/80 text-white hover:bg-zinc-700'
                  }`}
                  onClick={() => setSelectedLanguage(lang)}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="text-sm font-medium">{lang.name}</span>
                </button>
              ))}
            </div>

            {/* Play Button */}
            <Button
              size="lg"
              className="gradient-red text-foreground font-semibold px-12 py-6 text-lg hover:opacity-90 transition-opacity shadow-glow mt-6"
              onClick={handlePlay}
            >
              <Play className="w-6 h-6 mr-3 fill-current" />
              Play in {selectedLanguage.name}
            </Button>

            <p className="text-zinc-400 text-sm">
              Language availability depends on the source
            </p>
          </div>
        </div>
      ) : (
        /* Video iframe */
        <iframe
          src={getEmbedUrl()}
          className="absolute inset-0 w-full h-full"
          style={{ border: 'none' }}
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        />
      )}

      {/* Bottom Controls Bar (when playing) */}
      {isPlaying && (
        <div 
          className={`absolute bottom-0 left-0 right-0 z-[10001] bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white text-sm">
              <span className="text-lg">{selectedLanguage.flag}</span>
              <span>{selectedLanguage.name}</span>
            </div>
            
            <div className="text-zinc-400 text-xs">
              Press ESC to exit
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
