import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MovieCard } from "@/components/MovieCard";
import { CurationCardOverlay } from "./CurationCardOverlay";
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
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
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
        sectionId={sectionId}
      />
      {/* Overlay with drag handle */}
      <CurationCardOverlay
        tmdbId={movie.id}
        mediaType={mediaType as "movie" | "tv"}
        sectionId={sectionId}
        title={movie.title || movie.name}
        posterPath={movie.poster_path}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
