import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Movie } from "@/lib/tmdb";
import { MovieCard } from "./MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TabbedContentRowProps {
  title: string;
  moviesItems: Movie[];
  tvItems: Movie[];
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
}

export const TabbedContentRow = ({
  title,
  moviesItems,
  tvItems,
  isLoading = false,
  size = "md",
}: TabbedContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"movies" | "tv">("movies");
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
      setAnimationKey(prev => prev + 1);
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    }
  };

  const items = activeTab === "movies" ? moviesItems : tvItems;

  return (
    <section className="py-6 group/section">
      {/* Header */}
      <div className="container mx-auto px-4 flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        
        {/* Tab Buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleTabChange("movies")}
            className={cn(
              "px-2 py-1 text-sm font-medium transition-all duration-300 relative",
              activeTab === "movies"
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
              activeTab === "tv"
                ? "text-foreground tab-glow-active"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            TV Shows
          </button>
        </div>
      </div>

      {/* Scrollable Content with Navigation Overlay */}
      <div className="relative">
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
          className="flex gap-4 overflow-x-auto hide-scrollbar px-4 tab-content-enter"
        >
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 sm:w-48">
                  <Skeleton className="aspect-[2/3] rounded-xl" />
                  <Skeleton className="h-4 w-3/4 mt-3" />
                  <Skeleton className="h-3 w-1/2 mt-2" />
                </div>
              ))
            : items.map((movie, idx) => (
                <MovieCard
                  key={movie.id}
                  movie={{
                    ...movie,
                    media_type: activeTab === "movies" ? "movie" : "tv",
                  }}
                  index={idx}
                  size={size}
                />
              ))}
        </div>
      </div>
    </section>
  );
};
