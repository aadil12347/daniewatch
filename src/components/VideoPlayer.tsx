import { useEffect, useState } from "react";
import { X, Play, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchBloggerForTmdbId, BloggerVideoResult } from "@/lib/blogger";
import { useMedia } from "@/contexts/MediaContext";

interface VideoPlayerProps {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  onClose: () => void;
  inline?: boolean; // When true, renders inline in hero section instead of fullscreen
}

const LOADING_TIPS = [
  "Preparing your stream...",
  "Loading video content...",
  "Setting up the player...",
  "Buffering for smooth playback...",
  "Almost ready...",
  "Getting everything ready...",
  "Just a moment...",
];

const MIN_LOADING_TIME = 10000; // 10 seconds minimum

export const VideoPlayer = ({ tmdbId, type, season = 1, episode = 1, onClose, inline = false }: VideoPlayerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [bloggerResult, setBloggerResult] = useState<BloggerVideoResult | null>(null);
  const { setIsVideoPlaying } = useMedia();
  
  // Enhanced loading states
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  // Combined loading state - show until BOTH conditions are met
  const showLoading = isLoading || !minTimeElapsed || isIframeLoading;

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

  // Minimum 10-second timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_LOADING_TIME);

    return () => clearTimeout(timer);
  }, []);

  // Progress animation: 0% to 90% over 10 seconds
  useEffect(() => {
    const startTime = Date.now();
    const duration = MIN_LOADING_TIME;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 90, 90);
      setLoadingProgress(progress);

      if (elapsed < duration) {
        requestAnimationFrame(updateProgress);
      }
    };

    requestAnimationFrame(updateProgress);
  }, []);

  // Jump to 100% when loading completes
  useEffect(() => {
    if (!showLoading) {
      setLoadingProgress(100);
    }
  }, [showLoading]);

  // Rotate loading tips every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Build the Cinemaos embed URL (fallback)
  const getCinemaosUrl = () => {
    if (type === "movie") {
      return `https://player.videasy.net/movie/${tmdbId}`;
    } else {
      return `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
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
    return getCinemaosUrl();
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
      {/* Enhanced Loading state - seamless blend with page */}
      {showLoading && (
        <div className="absolute -inset-8 z-10">
          {/* Base with blur to blend edges */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, hsl(var(--background)) 20%, hsl(var(--background) / 0.95) 40%, hsl(var(--background) / 0.7) 60%, transparent 85%)',
              filter: 'blur(20px)',
            }}
          />
          
          {/* Sharp inner content area */}
          <div 
            className="absolute inset-8"
            style={{
              background: 'radial-gradient(ellipse at center, hsl(var(--background)) 0%, hsl(var(--background)) 50%, transparent 100%)',
            }}
          />
          
          {/* Soft edge blend - all directions */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse at center, transparent 30%, hsl(var(--background) / 0.5) 60%, hsl(var(--background)) 90%),
                linear-gradient(to bottom, hsl(var(--background)) 0%, transparent 15%, transparent 85%, hsl(var(--background)) 100%),
                linear-gradient(to right, hsl(var(--background)) 0%, transparent 15%, transparent 85%, hsl(var(--background)) 100%)
              `,
              filter: 'blur(8px)',
            }}
          />
          
          {/* Subtle center glow */}
          <div 
            className="absolute inset-8 opacity-25"
            style={{ 
              background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.3) 0%, transparent 60%)' 
            }} 
          />

          {/* Main loading content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative z-10 flex flex-col items-center">
              {/* Animated icon with glow */}
              <div className="relative mb-8">
                {/* Outer glow ring - lightweight pulse */}
                <div className="absolute -inset-2 rounded-full bg-primary/10 animate-pulse" style={{ animationDuration: '2s' }} />
                
                {/* Inner spinning ring */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="absolute w-full h-full animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-primary/20"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="text-primary"
                      strokeDasharray={`${loadingProgress * 2.83} 283`}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="w-6 h-6 text-primary fill-primary" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress percentage */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-white">{Math.round(loadingProgress)}%</span>
              </div>

              {/* Linear progress bar */}
              <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mb-6">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>

              {/* Rotating tips with fade animation */}
              <div className="h-6 relative">
                <p 
                  key={tipIndex}
                  className="text-white/70 text-sm animate-fade-in"
                >
                  {LOADING_TIPS[tipIndex]}
                </p>
              </div>

              {/* Film reel decoration */}
              <div className="mt-8 flex items-center gap-2 text-white/30">
                <Film className="w-4 h-4" />
                <span className="text-xs">Preparing your viewing experience</span>
                <Film className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close button - positioned below header for inline mode */}
      <Button
        variant="ghost"
        size="icon"
        className={`absolute ${inline ? 'top-20 md:top-24 z-[80]' : 'top-4 z-[10000]'} right-4 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white pointer-events-auto`}
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Video iframe - always rendered but hidden during loading */}
      {!isLoading && (
        <iframe
          src={getEmbedUrl()}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          className={`transition-opacity duration-500 ${showLoading ? 'opacity-0' : 'opacity-100'}`}
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          onLoad={() => setIsIframeLoading(false)}
        />
      )}
    </div>
  );
};
