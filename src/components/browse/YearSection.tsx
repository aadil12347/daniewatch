import { useMemo } from "react";
import { Movie } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { Skeleton } from "@/components/ui/skeleton";

type MediaType = "movie" | "tv" | "mixed";

export function YearSection({
  yearLabel,
  items,
  isLoading,
  mediaType,
  size = "md",
}: {
  yearLabel: string;
  items: Movie[];
  isLoading: boolean;
  mediaType: MediaType;
  size?: "sm" | "md" | "lg";
}) {
  const normalized = useMemo(() => {
    if (mediaType === "mixed") return items;
    return items.map((it) => ({ ...it, media_type: mediaType }));
  }, [items, mediaType]);

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold">{yearLabel}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
        {isLoading
          ? Array.from({ length: 18 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4 mt-3" />
                <Skeleton className="h-3 w-1/2 mt-2" />
              </div>
            ))
          : normalized.map((item, idx) => (
              <MovieCard key={`${item.id}-${item.media_type ?? mediaType}-${idx}`} movie={item} size={size} />
            ))}
      </div>
    </section>
  );
}
