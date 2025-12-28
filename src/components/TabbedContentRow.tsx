import { useRef, useState } from "react";
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

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const items = activeTab === "movies" ? moviesItems : tvItems;

  return (
    <section className="py-6">
      {/* Header */}
      <div className="container mx-auto px-4 flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        
        <div className="flex items-center gap-4">
          {/* Tab Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab("movies");
                if (scrollRef.current) scrollRef.current.scrollLeft = 0;
              }}
              className={cn(
                "tab-glow-button px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300",
                activeTab === "movies"
                  ? "bg-primary/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Movies
            </button>
            <button
              onClick={() => {
                setActiveTab("tv");
                if (scrollRef.current) scrollRef.current.scrollLeft = 0;
              }}
              className={cn(
                "tab-glow-button px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300",
                activeTab === "tv"
                  ? "bg-primary/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              TV Shows
            </button>
          </div>

          {/* Navigation Buttons */}
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
      </div>

      {/* Scrollable Content */}
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
                movie={{
                  ...movie,
                  media_type: activeTab === "movies" ? "movie" : "tv",
                }}
                index={idx}
                size={size}
              />
            ))}
      </div>
    </section>
  );
};
