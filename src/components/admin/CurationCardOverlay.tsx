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
  isDragging?: boolean;
}

export function CurationCardOverlay({
  tmdbId,
  mediaType,
  sectionId,
  title,
  posterPath,
  className,
  isDragging,
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
    <>
      {/* Pinned badge - top center */}
      {isPinned && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-2 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide shadow-lg">
          <Pin className="w-3 h-3" />
          Pinned
        </div>
      )}

      {/* Action buttons - bottom LEFT (aligned with three-dots menu) */}
      <div
        className={cn(
          "absolute bottom-[4.5rem] left-2 z-40 flex items-center gap-1",
          "transition-opacity duration-200",
          className
        )}
      >
        {/* Pin/Unpin button */}
        <button
          onClick={handlePin}
          className={cn(
            "p-1.5 rounded-md backdrop-blur-sm transition-all duration-150 shadow-md",
            isPinned
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : "bg-background/90 text-foreground hover:bg-primary/20 border border-border/50"
          )}
          title={isPinned ? "Unpin from top" : "Pin to top"}
        >
          {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>

        {/* Remove button - only show if item is in curated list */}
        {isInSection && (
          <button
            onClick={handleRemove}
            className="p-1.5 rounded-md bg-background/90 backdrop-blur-sm border border-border/50 text-destructive hover:bg-destructive/20 hover:border-destructive/50 transition-all duration-150 shadow-md"
            title="Remove from section"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Curated indicator border */}
      {isInSection && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl pointer-events-none z-30",
            "ring-2 ring-inset",
            isPinned ? "ring-primary/60" : "ring-primary/30"
          )}
        />
      )}
    </>
  );
}
