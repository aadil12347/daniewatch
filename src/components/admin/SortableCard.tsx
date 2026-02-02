import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MovieCard } from "@/components/MovieCard";
import { CurationCardOverlay } from "./CurationCardOverlay";
import { cn } from "@/lib/utils";
import type { Movie } from "@/lib/tmdb";

interface SortableCardProps {
  movie: Movie;
  index: number;
  sectionId: string;
  showRank?: boolean;
  size?: "sm" | "md" | "lg";
  hoverCharacterMode?: "popout" | "contained";
  enableHoverPortal?: boolean;
  disableHoverCharacter?: boolean;
  disableHoverLogo?: boolean;
  disableRankFillHover?: boolean;
}

export function SortableCard({
  movie,
  index,
  sectionId,
  showRank,
  size,
  hoverCharacterMode,
  enableHoverPortal,
  disableHoverCharacter,
  disableHoverLogo,
  disableRankFillHover,
}: SortableCardProps) {
  const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
  const sortableId = `${movie.id}-${mediaType}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative flex-shrink-0 touch-none",
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-90 scale-[1.02] ring-2 ring-primary/60 rounded-xl shadow-xl"
      )}
    >
      {/* Curation overlay - no drag handle, entire card is draggable */}
      <CurationCardOverlay
        tmdbId={movie.id}
        mediaType={mediaType as "movie" | "tv"}
        sectionId={sectionId}
        title={movie.title || movie.name}
        posterPath={movie.poster_path}
        isDragging={isDragging}
      />

      {/* MovieCard handles the actual display */}
      <MovieCard
        movie={movie}
        index={index}
        showRank={showRank}
        size={size}
        hoverCharacterMode={hoverCharacterMode}
        enableHoverPortal={enableHoverPortal}
        disableHoverCharacter={disableHoverCharacter}
        disableHoverLogo={disableHoverLogo}
        disableRankFillHover={disableRankFillHover}
      />
    </div>
  );
}
