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
    <section className="py-6">
      {/* Header */}
      <div className="container mx-auto px-4 flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className="p-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="p-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-4 overflow-x-auto hide-scrollbar px-4",
          showRank && "pl-12 sm:pl-16"
        )}
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
    </section>
  );
};
