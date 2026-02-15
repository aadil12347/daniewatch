import React from "react";
import { Play, Download } from "lucide-react";
import { Episode, getImageUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface EpisodeCardProps {
  episode: Episode;
  isActive?: boolean;
  onClick?: () => void;
  downloadLink?: string;
}

export const EpisodeCard = ({ episode, isActive, onClick, downloadLink }: EpisodeCardProps) => {
  const stillUrl = episode.still_path
    ? getImageUrl(episode.still_path, "w300")
    : null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloadLink) {
      haptic("tap");
      window.open(downloadLink, '_blank');
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex gap-2 md:gap-4 p-2 md:p-3 rounded-lg md:rounded-xl cursor-pointer transition-all duration-300 group/episode",
        isActive
          ? "bg-primary/20 border-2 border-primary shadow-[0_0_30px_hsl(var(--primary)/0.4)] ring-2 ring-primary/30"
          : "hover:bg-secondary/50 border-2 border-transparent"
      )}
    >
      {/* Thumbnail */}
      <div className={cn(
        "relative flex-shrink-0 w-24 md:w-40 aspect-video rounded-md md:rounded-lg overflow-hidden bg-muted transition-all duration-300",
        isActive && "ring-2 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
      )}>
        {stillUrl ? (
          <img
            src={stillUrl}
            alt={episode.name}
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              isActive && "brightness-75"
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <span className="text-muted-foreground text-[10px] md:text-xs">No Image</span>
          </div>
        )}

        {/* Playing indicator overlay */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
            <div className="relative">
              {/* Pulsing play button */}
              <div className="absolute inset-0 animate-ping opacity-30">
                <div className="p-2 md:p-3 rounded-full bg-red-500">
                  <Play className="w-4 h-4 md:w-6 md:h-6 fill-white text-white" />
                </div>
              </div>
              <div className="relative p-2 md:p-3 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]">
                <Play className="w-4 h-4 md:w-6 md:h-6 fill-white text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Play overlay for non-active episodes */}
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover/episode:opacity-100 transition-opacity duration-300">
            <div className="p-1.5 md:p-2 rounded-full bg-primary">
              <Play className="w-3 h-3 md:w-5 md:h-5 fill-current" />
            </div>
          </div>
        )}

        {/* Episode number badge */}
        <div className={cn(
          "absolute top-1 left-1 md:top-2 md:left-2 px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-semibold transition-all duration-300",
          isActive
            ? "bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]"
            : "bg-background/80"
        )}>
          {episode.episode_number}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5 md:py-1">
        <h4 className={cn(
          "font-semibold text-xs md:text-sm mb-0.5 md:mb-1 line-clamp-1 transition-all duration-300",
          isActive
            ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse"
            : "group-hover/episode:text-primary"
        )}>
          {episode.name}
        </h4>
        <p className="text-muted-foreground text-[10px] md:text-xs line-clamp-2">
          {episode.overview || "No description available."}
        </p>
        {episode.runtime && (
          <span className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2 inline-block">
            {episode.runtime}m
          </span>
        )}
      </div>

      {/* Download button */}
      {downloadLink && (
        <button
          onClick={handleDownload}
          className="flex-shrink-0 self-center p-2 md:p-3 rounded-md md:rounded-lg border-2 border-primary/80 text-primary transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
          title="Download episode"
        >
          <Download className="w-4 h-4 md:w-6 md:h-6" />
        </button>
      )}
    </div>
  );
};
