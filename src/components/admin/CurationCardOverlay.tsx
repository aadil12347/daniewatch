import { Pin, X, PinOff } from "lucide-react";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useSectionCuration } from "@/hooks/useSectionCuration";
import { cn } from "@/lib/utils";

interface CurationCardOverlayProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  sectionId: string;
  title?: string;
  posterPath?: string | null;
  className?: string;
}

export function CurationCardOverlay({
  tmdbId,
  mediaType,
  sectionId,
  title,
  posterPath,
  className,
}: CurationCardOverlayProps) {
  const { isAdmin } = useAdminStatus();
  const { isEditLinksMode } = useEditLinksMode();
  const { curatedItems, pinToTop, unpinFromTop, removeFromSection } = useSectionCuration(sectionId);

  if (!isAdmin || !isEditLinksMode) return null;

  const curatedItem = curatedItems.find((c) => c.tmdbId === tmdbId && c.mediaType === mediaType);
  const isPinned = curatedItem?.isPinned ?? false;
  const isInSection = !!curatedItem;

  const handlePin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPinned) {
      await unpinFromTop(tmdbId, mediaType);
    } else {
      await pinToTop(tmdbId, mediaType, { title, posterPath: posterPath ?? undefined });
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    await removeFromSection(tmdbId, mediaType);
  };

  return (
    <div
      className={cn(
        "absolute bottom-2 left-2 z-40 flex items-center gap-1",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
        className
      )}
    >
      {/* Pin/Unpin button */}
      <button
        onClick={handlePin}
        className={cn(
          "p-1.5 rounded-md backdrop-blur-sm transition-all duration-150",
          isPinned
            ? "bg-primary/80 text-primary-foreground hover:bg-primary"
            : "bg-background/80 text-foreground hover:bg-primary/20 border border-border/50"
        )}
        title={isPinned ? "Unpin from top" : "Pin to top"}
      >
        {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
      </button>

      {/* Remove button - only show if item is in curated list */}
      {isInSection && (
        <button
          onClick={handleRemove}
          className="p-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border/50 text-destructive hover:bg-destructive/20 transition-all duration-150"
          title="Remove from section"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
