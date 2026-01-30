import { useMemo, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Movie } from "@/lib/tmdb";
import { MovieCard } from "./MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePostModeration } from "@/hooks/usePostModeration";
import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { SectionCurationControls } from "@/components/admin/SectionCurationControls";
import { useSectionCuration } from "@/hooks/useSectionCuration";
import { SortableCard } from "@/components/admin/SortableCard";

interface ContentRowProps {
  title: string;
  items: Movie[];
  isLoading?: boolean;
  showRank?: boolean;
  size?: "sm" | "md" | "lg";
  hoverCharacterMode?: "popout" | "contained";
  enableHoverPortal?: boolean;
  disableHoverCharacter?: boolean;
  disableHoverLogo?: boolean;
  disableRankFillHover?: boolean;
  sectionId?: string;
}

export const ContentRow = ({
  title,
  items,
  isLoading = false,
  showRank = false,
  size = "md",
  hoverCharacterMode,
  enableHoverPortal,
  disableHoverCharacter,
  disableHoverLogo,
  disableRankFillHover,
  sectionId,
}: ContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { filterBlockedPosts } = usePostModeration();
  const { isAdmin } = useAdminStatus();
  const { isEditLinksMode } = useEditLinksMode();
  const { getCuratedItems, reorderSection } = useSectionCuration(sectionId);

  const baseVisibleItems = useMemo(() => filterBlockedPosts(items), [filterBlockedPosts, items]);
  
  // Apply curation if in edit mode and sectionId provided
  const visibleItems = useMemo(() => {
    if (isAdmin && isEditLinksMode && sectionId) {
      return getCuratedItems(baseVisibleItems);
    }
    return baseVisibleItems;
  }, [baseVisibleItems, getCuratedItems, isAdmin, isEditLinksMode, sectionId]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Generate sortable IDs
  const sortableIds = useMemo(() => {
    return visibleItems.map((movie) => {
      const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
      return `${movie.id}-${mediaType}`;
    });
  }, [visibleItems]);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = sortableIds.indexOf(String(active.id));
        const newIndex = sortableIds.indexOf(String(over.id));

        if (oldIndex !== -1 && newIndex !== -1) {
          // Create new order
          const newIds = [...sortableIds];
          const [removed] = newIds.splice(oldIndex, 1);
          newIds.splice(newIndex, 0, removed);

          // Convert back to items
          const orderedItems = newIds.map((id) => {
            const [tmdbId, mediaType] = id.split("-");
            return { tmdbId: parseInt(tmdbId, 10), mediaType: mediaType as "movie" | "tv" };
          });

          reorderSection(orderedItems);
        }
      }
    },
    [sortableIds, reorderSection]
  );

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const isDraggable = isAdmin && isEditLinksMode && sectionId;

  const renderCards = () => {
    if (isLoading) {
      return Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-40 sm:w-48">
          <Skeleton className="aspect-[2/3] rounded-xl" />
          <Skeleton className="h-4 w-3/4 mt-3" />
          <Skeleton className="h-3 w-1/2 mt-2" />
        </div>
      ));
    }

    if (isDraggable) {
      return visibleItems.map((movie, idx) => (
        <SortableCard
          key={`${movie.id}-${movie.media_type || (movie.first_air_date ? "tv" : "movie")}`}
          movie={movie}
          index={idx}
          sectionId={sectionId!}
          showRank={showRank}
          size={size}
          hoverCharacterMode={hoverCharacterMode}
          enableHoverPortal={enableHoverPortal}
          disableHoverCharacter={disableHoverCharacter}
          disableHoverLogo={disableHoverLogo}
          disableRankFillHover={disableRankFillHover}
        />
      ));
    }

    return visibleItems.map((movie, idx) => (
      <MovieCard
        key={movie.id}
        movie={movie}
        index={idx}
        showRank={showRank}
        size={size}
        hoverCharacterMode={hoverCharacterMode}
        enableHoverPortal={enableHoverPortal}
        disableHoverCharacter={disableHoverCharacter}
        disableHoverLogo={disableHoverLogo}
        disableRankFillHover={disableRankFillHover}
        sectionId={sectionId}
      />
    ));
  };

  return (
    <section className="py-6 group/section">
      {/* Header */}
      <div className="container mx-auto px-4 flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {showRank ? (
            <h2 className="group/title cursor-default">
              <span 
                className="text-3xl md:text-4xl font-black text-foreground transition-all duration-300 group-hover/title:drop-shadow-[0_0_20px_hsl(var(--primary))] group-hover/title:text-primary"
              >
                {title}
              </span>
            </h2>
          ) : (
            <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
          )}
        </div>
        
        {/* Curation Controls - Admin only */}
        {sectionId && <SectionCurationControls sectionId={sectionId} sectionTitle={title} />}
      </div>

      {/* Scrollable Content with Navigation Overlay */}
      <div className="relative">
        {/* Mobile scroll indicators - vignette effect with bounce animation */}
        <div className="lg:hidden absolute left-0 top-0 bottom-8 z-10 w-4 bg-gradient-to-r from-background/80 to-transparent pointer-events-none animate-scroll-hint-left" />
        <div className="lg:hidden absolute right-0 top-0 bottom-8 z-10 w-4 bg-gradient-to-l from-background/80 to-transparent pointer-events-none animate-scroll-hint-right" />

        {/* Left Navigation Button - Hidden on mobile/tablet */}
        <button
          onClick={() => scroll("left")}
          className="hidden lg:flex absolute left-0 top-0 bottom-8 z-10 w-12 items-center justify-center bg-gradient-to-r from-background/90 to-transparent opacity-0 group-hover/section:opacity-100 translate-x-[-20px] group-hover/section:translate-x-0 transition-[opacity,transform] duration-300 ease-out"
        >
          <div className="p-3 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary hover:border-primary hover:shadow-glow transition-[background-color,border-color,box-shadow] duration-200">
            <ChevronLeft className="w-6 h-6" />
          </div>
        </button>

        {/* Right Navigation Button - Hidden on mobile/tablet */}
        <button
          onClick={() => scroll("right")}
          className="hidden lg:flex absolute right-0 top-0 bottom-8 z-10 w-12 items-center justify-center bg-gradient-to-l from-background/90 to-transparent opacity-0 group-hover/section:opacity-100 translate-x-[20px] group-hover/section:translate-x-0 transition-[opacity,transform] duration-300 ease-out"
        >
          <div className="p-3 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary hover:border-primary hover:shadow-glow transition-[background-color,border-color,box-shadow] duration-200">
            <ChevronRight className="w-6 h-6" />
          </div>
        </button>

        {isDraggable ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto overflow-y-visible hide-scrollbar px-4 pb-10 scroll-smooth"
              >
                {renderCards()}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto overflow-y-visible hide-scrollbar px-4 pb-10 scroll-smooth"
          >
            {renderCards()}
          </div>
        )}
      </div>
    </section>
  );
};
