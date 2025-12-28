import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Movie } from "@/lib/tmdb";
import { MovieCard } from "./MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ContentRowProps {
  title: string;
  items: Movie[];
  isLoading?: boolean;
  showRank?: boolean;
  size?: "sm" | "md" | "lg";
}

export const ContentRow = ({
  title,
  items,
  isLoading = false,
  showRank = false,
  size = "md",
}: ContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-6 group/section">
      {/* Header */}
      <div className="container mx-auto px-4 flex items-center justify-between mb-4">
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

      {/* Scrollable Content with Navigation Overlay */}
      <div className="relative">
        {/* Left Navigation Button */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 opacity-0 group-hover/section:opacity-100 transition-all duration-300 hover:bg-primary hover:border-primary hover:shadow-glow"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Right Navigation Button */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 opacity-0 group-hover/section:opacity-100 transition-all duration-300 hover:bg-primary hover:border-primary hover:shadow-glow"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto hide-scrollbar px-4"
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
                  movie={movie}
                  index={idx}
                  showRank={showRank}
                  size={size}
                />
              ))}
        </div>
      </div>
    </section>
  );
};
