import { Play, Download } from "lucide-react";
import { Episode, getImageUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

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
      window.open(downloadLink, '_blank');
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex gap-2 md:gap-4 p-2 md:p-3 rounded-lg md:rounded-xl cursor-pointer transition-all duration-300 group/episode",
        isActive 
          ? "bg-primary/20 border border-primary/50" 
          : "hover:bg-secondary/50"
      )}
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-24 md:w-40 aspect-video rounded-md md:rounded-lg overflow-hidden bg-muted">
        {stillUrl ? (
          <img
            src={stillUrl}
            alt={episode.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <span className="text-muted-foreground text-[10px] md:text-xs">No Image</span>
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover/episode:opacity-100 transition-opacity duration-300">
          <div className="p-1.5 md:p-2 rounded-full bg-primary">
            <Play className="w-3 h-3 md:w-5 md:h-5 fill-current" />
          </div>
        </div>
        {/* Episode number badge */}
        <div className="absolute top-1 left-1 md:top-2 md:left-2 px-1.5 md:px-2 py-0.5 rounded bg-background/80 text-[10px] md:text-xs font-semibold">
          {episode.episode_number}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5 md:py-1">
        <h4 className="font-semibold text-xs md:text-sm mb-0.5 md:mb-1 line-clamp-1 group-hover/episode:text-primary transition-colors">
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
