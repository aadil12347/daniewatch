import { useEffect, useRef, useState } from "react";
import { X, Play } from "lucide-react";
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

const LOADING_TIPS = [
  "Preparing your stream...",
  "Loading video content...",
  "Setting up the player...",
  "Buffering for smooth playback...",
  "Almost ready...",
  "Getting everything ready...",
  "Just a moment...",
];

const MIN_LOADING_TIME = 12000; // 12 seconds

export const VideoPlayer = ({ tmdbId, type, season = 1, episode = 1, onClose }: VideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bloggerResult, setBloggerResult] = useState<BloggerVideoResult | null>(null);
  const { setIsVideoPlaying } = useMedia();
  
  // Enhanced loading states
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  // Show loading instantly - don't wait for API call
  const showLoading = !minTimeElapsed || isIframeLoading;

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

  // Minimum 12-second timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_LOADING_TIME);

    return () => clearTimeout(timer);
  }, []);

  // Smooth progress animation using requestAnimationFrame
  useEffect(() => {
    const startTime = Date.now();
    const duration = MIN_LOADING_TIME;
    let animationId: number;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 90, 90);
      setLoadingProgress(progress);

      if (elapsed < duration) {
        animationId = requestAnimationFrame(updateProgress);
      }
    };

    animationId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Jump to 100% when loading completes
  useEffect(() => {
    if (!showLoading) {
      setLoadingProgress(100);
    }
  }, [showLoading]);

  // Rotate loading tips every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

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
    if (type === "tv" && bloggerResult?.seasonEpisodeLinks && episode) {
      const episodeLink = bloggerResult.seasonEpisodeLinks[episode - 1];
      if (episodeLink) {
        console.log(`Using Blogger episode link for S${season}E${episode}:`, episodeLink);
        return episodeLink;
      }
    }
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
    window.history.pushState({ videoPlayer: true }, '');

    const handlePopState = () => {
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
      className="fixed inset-0 w-screen h-screen z-[9999] bg-black animate-fade-in"
      style={{ animationDuration: '150ms' }}
    >
      {/* Lightweight Loading State */}
      {showLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          {/* Static radial gradient - no animation, no blur */}
          <div 
            className="absolute inset-0 opacity-60"
            style={{
              background: 'radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.15) 0%, transparent 50%)'
            }}
          />

          {/* Main loading content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Smooth orbital spinner */}
            <div className="relative w-28 h-28 mb-8">
              {/* Outer static ring */}
              <div className="absolute inset-0 rounded-full border border-white/10" />
              
              {/* Spinning orbital ring with dot */}
              <div 
                className="absolute inset-0 rounded-full"
                style={{
                  animation: 'smooth-spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                  willChange: 'transform'
                }}
              >
                <div 
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full"
                  style={{
                    boxShadow: '0 0 12px 4px hsl(var(--primary) / 0.6)'
                  }}
                />
              </div>
              
              {/* Progress arc SVG */}
              <svg 
                className="absolute inset-0 -rotate-90" 
                viewBox="0 0 100 100"
                style={{ willChange: 'transform' }}
              >
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="hsl(var(--primary) / 0.15)"
                  strokeWidth="2"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${loadingProgress * 2.64} 264`}
                  style={{ 
                    transition: 'stroke-dasharray 100ms ease-out',
                    willChange: 'stroke-dasharray'
                  }}
                />
              </svg>
              
              {/* Center play icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center"
                  style={{
                    boxShadow: 'inset 0 0 20px hsl(var(--primary) / 0.1)'
                  }}
                >
                  <Play className="w-7 h-7 text-primary fill-primary ml-0.5" />
                </div>
              </div>
            </div>

            {/* Progress percentage */}
            <div className="mb-4">
              <span className="text-4xl font-light text-white tabular-nums">
                {Math.round(loadingProgress)}
                <span className="text-white/50 text-2xl">%</span>
              </span>
            </div>

            {/* GPU-accelerated progress bar using scaleX */}
            <div className="w-72 h-1 bg-white/10 rounded-full overflow-hidden mb-6">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full origin-left"
                style={{ 
                  transform: `scaleX(${loadingProgress / 100})`,
                  transition: 'transform 100ms ease-out',
                  willChange: 'transform'
                }}
              />
            </div>

            {/* Rotating tips with smooth opacity */}
            <div className="h-6">
              <p 
                key={tipIndex}
                className="text-white/50 text-sm font-light"
                style={{
                  animation: 'fade-in 300ms ease-out',
                  willChange: 'opacity'
                }}
              >
                {LOADING_TIPS[tipIndex]}
              </p>
            </div>
          </div>

          {/* Inline keyframes for smooth-spin */}
          <style>{`
            @keyframes smooth-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-[10000] w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors duration-200"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Video iframe - rendered when API call completes */}
      {!isLoading && (
        <iframe
          src={getEmbedUrl()}
          className="absolute inset-0 w-full h-full border-none"
          style={{
            opacity: showLoading ? 0 : 1,
            transition: 'opacity 400ms ease-out',
            willChange: 'opacity'
          }}
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          onLoad={() => setIsIframeLoading(false)}
        />
      )}
    </div>
  );
};