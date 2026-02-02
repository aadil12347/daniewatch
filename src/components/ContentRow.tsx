import { useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Movie } from "@/lib/tmdb";
import { MovieCard } from "./MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePostModeration } from "@/hooks/usePostModeration";

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
}: ContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { filterBlockedPosts } = usePostModeration();

  const visibleItems = useMemo(() => filterBlockedPosts(items), [filterBlockedPosts, items]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

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

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto overflow-y-visible hide-scrollbar px-4 pb-10 scroll-smooth"
        >
          {renderCards()}
        </div>
      </div>
    </section>
  );
};
