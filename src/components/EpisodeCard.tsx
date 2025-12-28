import { Play } from "lucide-react";
import { Episode, getImageUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

interface EpisodeCardProps {
  episode: Episode;
  isActive?: boolean;
  onClick?: () => void;
}

export const EpisodeCard = ({ episode, isActive, onClick }: EpisodeCardProps) => {
  const stillUrl = episode.still_path 
    ? getImageUrl(episode.still_path, "w300") 
    : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex gap-4 p-3 rounded-xl cursor-pointer transition-all duration-300 group/episode",
        isActive 
          ? "bg-primary/20 border border-primary/50" 
          : "hover:bg-secondary/50"
      )}
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-muted">
        {stillUrl ? (
          <img
            src={stillUrl}
            alt={episode.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <span className="text-muted-foreground text-xs">No Image</span>
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover/episode:opacity-100 transition-opacity duration-300">
          <div className="p-2 rounded-full bg-primary">
            <Play className="w-5 h-5 fill-current" />
          </div>
        </div>
        {/* Episode number badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-background/80 text-xs font-semibold">
          {episode.episode_number}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-1">
        <h4 className="font-semibold text-sm mb-1 line-clamp-1 group-hover/episode:text-primary transition-colors">
          {episode.name}
        </h4>
        <p className="text-muted-foreground text-xs line-clamp-2">
          {episode.overview || "No description available."}
        </p>
        {episode.runtime && (
          <span className="text-xs text-muted-foreground mt-2 inline-block">
            {episode.runtime}m
          </span>
        )}
      </div>
    </div>
  );
};
