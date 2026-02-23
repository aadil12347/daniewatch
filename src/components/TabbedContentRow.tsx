import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Movie } from "@/lib/tmdb";
import { MovieCard } from "./MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePostModeration } from "@/hooks/usePostModeration";

interface TabbedContentRowProps {
  title: string;
  moviesItems: Movie[];
  tvItems: Movie[];
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
  defaultTab?: "movies" | "tv";
  hoverCharacterMode?: "popout" | "contained";
  enableHoverPortal?: boolean;
}

const MIN_ITEMS = 10;

export const TabbedContentRow = ({
  title,
  moviesItems,
  tvItems,
  isLoading = false,
  size = "md",
  defaultTab = "movies",
  hoverCharacterMode,
  enableHoverPortal,
}: TabbedContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { filterBlockedPosts } = usePostModeration();

  const [activeTab, setActiveTab] = useState<"movies" | "tv">(defaultTab);
  const [animationKey, setAnimationKey] = useState(0);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleTabChange = (tab: "movies" | "tv") => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setAnimationKey((prev) => prev + 1);
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    }
  };

  // Filter items and ensure minimum 10 items per tab
  const filteredMovies = useMemo(
    () => filterBlockedPosts(moviesItems, "movie"),
    [filterBlockedPosts, moviesItems]
  );

  const filteredTv = useMemo(
    () => filterBlockedPosts(tvItems, "tv"),
    [filterBlockedPosts, tvItems]
  );

  // Only show tabs that have minimum 10 items
  const hasMovies = filteredMovies.length >= MIN_ITEMS;
  const hasTv = filteredTv.length >= MIN_ITEMS;

  // Auto-switch tab if current tab doesn't have enough items
  const effectiveTab = activeTab === "movies" && !hasMovies && hasTv
    ? "tv"
    : activeTab === "tv" && !hasTv && hasMovies
      ? "movies"
      : activeTab;

  const items = effectiveTab === "movies" ? filteredMovies : filteredTv;
  const visibleItems = items;

  const renderCards = () => {
    if (isLoading) {
      // Match skeleton size to actual poster sizes (md is default)
      const skeletonSizeClass = size === "lg" ? "w-48 sm:w-56" : size === "sm" ? "w-32 sm:w-36" : "w-40 sm:w-48";

      return Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`flex-shrink-0 ${skeletonSizeClass}`}>
          <Skeleton className="aspect-[2/3] rounded-xl" />
          <Skeleton className="h-3 w-3/4 mt-2" />
          <Skeleton className="h-2.5 w-1/2 mt-1.5" />
        </div>
      ));
    }

    return visibleItems.map((movie, idx) => (
      <MovieCard
        key={movie.id}
        movie={{
          ...movie,
          media_type: effectiveTab === "movies" ? "movie" : "tv",
        }}
        index={idx}
        size={size}
        hoverCharacterMode={hoverCharacterMode}
        enableHoverPortal={enableHoverPortal}
      />
    ));
  };

  // Don't render if neither tab has minimum items
  if (!hasMovies && !hasTv) {
    return null;
  }

  return (
    <section className="py-6 group/section">
      {/* Header */}
      <div className="container mx-auto px-4 flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        </div>

        <div className="flex items-center gap-4">
          {/* Tab Buttons - only show both if both have minimum items */}
          {(hasMovies && hasTv) && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleTabChange("movies")}
                className={cn(
                  "px-2 py-1 text-sm font-medium transition-all duration-300 relative",
                  effectiveTab === "movies"
                    ? "text-foreground tab-glow-active"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Movies
              </button>
              <button
                onClick={() => handleTabChange("tv")}
                className={cn(
                  "px-2 py-1 text-sm font-medium transition-all duration-300 relative",
                  effectiveTab === "tv"
                    ? "text-foreground tab-glow-active"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                TV Shows
              </button>
            </div>
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
          className="hidden lg:flex absolute left-0 top-0 bottom-8 z-10 w-12 items-center justify-center bg-gradient-to-r from-background/90 to-transparent opacity-0 group-hover/section:opacity-100 translate-x-[-20px] group-hover/section:translate-x-0 transition-all duration-500 ease-out"
        >
          <div className="p-3 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary hover:border-primary hover:shadow-glow transition-all duration-300">
            <ChevronLeft className="w-6 h-6" />
          </div>
        </button>

        {/* Right Navigation Button - Hidden on mobile/tablet */}
        <button
          onClick={() => scroll("right")}
          className="hidden lg:flex absolute right-0 top-0 bottom-8 z-10 w-12 items-center justify-center bg-gradient-to-l from-background/90 to-transparent opacity-0 group-hover/section:opacity-100 translate-x-[20px] group-hover/section:translate-x-0 transition-all duration-500 ease-out"
        >
          <div className="p-3 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary hover:border-primary hover:shadow-glow transition-all duration-300">
            <ChevronRight className="w-6 h-6" />
          </div>
        </button>

        <div
          key={animationKey}
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto overflow-y-visible hide-scrollbar px-4 pb-10 tab-content-enter"
        >
          {renderCards()}
        </div>
      </div>
    </section>
  );
};
