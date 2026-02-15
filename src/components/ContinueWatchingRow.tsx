import { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Play, Clock, X } from "lucide-react";
import { useContinueWatching, ContinueWatchingItem } from "@/hooks/useContinueWatching";
import { usePerformanceMode } from "@/contexts/PerformanceModeContext";
import { Skeleton } from "@/components/ui/skeleton";
import { getPosterUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

interface ContinueWatchingCardProps {
    item: ContinueWatchingItem;
    onRemove: () => void;
    isPerformance: boolean;
}

const ContinueWatchingCard = ({ item, onRemove, isPerformance }: ContinueWatchingCardProps) => {
    const navigate = useNavigate();
    const posterUrl = getPosterUrl(item.posterPath, "w342");

    const handlePlay = () => {
        // Navigate to detail page with autoPlay state
        navigate(`/${item.mediaType}/${item.tmdbId}`, {
            state: {
                autoPlay: true,
                season: item.season,
                episode: item.episode,
            },
        });
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove();
    };

    // Format timestamp to relative time
    const getRelativeTime = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Episode label for TV shows
    const episodeLabel = item.mediaType === "tv" && item.season && item.episode
        ? `S${item.season} E${item.episode}`
        : null;

    return (
        <div className="flex-shrink-0 w-40 sm:w-48 group/card relative">
            {/* Poster Container */}
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted">
                {/* Poster Image */}
                <img
                    src={posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                    loading="lazy"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Episode Label (TV shows) - Larger and more prominent */}
                {episodeLabel && (
                    <div className="absolute top-2 left-2 px-3 py-1.5 bg-primary/95 rounded-lg text-sm font-bold text-primary-foreground shadow-lg backdrop-blur-sm">
                        {episodeLabel}
                    </div>
                )}

                {/* Remove Button */}
                <button
                    onClick={handleRemove}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-sm opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-destructive"
                    aria-label="Remove from history"
                >
                    <X className="w-3.5 h-3.5" />
                </button>

                {/* Play Button - Always visible on mobile, hover on desktop */}
                <button
                    onClick={handlePlay}
                    className={cn(
                        "absolute inset-0 flex items-center justify-center",
                        "transition-all duration-200",
                        isPerformance
                            ? "opacity-100" // Always visible in performance mode
                            : "opacity-100 md:opacity-0 md:group-hover/card:opacity-100"
                    )}
                >
                    <div className={cn(
                        "p-3 sm:p-4 rounded-full bg-primary shadow-lg",
                        "transition-transform duration-200",
                        "hover:scale-110 active:scale-95"
                    )}>
                        <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-primary-foreground text-primary-foreground" />
                    </div>
                </button>

                {/* Bottom Info */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-sm font-semibold text-white line-clamp-1">{item.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-white/70">
                        <Clock className="w-3 h-3" />
                        <span>{getRelativeTime(item.timestamp)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ContinueWatchingRow = () => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const { items, isLoading, removeItem } = useContinueWatching();
    const { isPerformance } = usePerformanceMode();

    // Don't render if no items and not loading
    if (!isLoading && items.length === 0) {
        return null;
    }

    const scroll = (direction: "left" | "right") => {
        if (scrollRef.current) {
            const scrollAmount = scrollRef.current.clientWidth * 0.8;
            scrollRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    const handleRemove = async (tmdbId: number, mediaType: "movie" | "tv") => {
        await removeItem(tmdbId, mediaType);
    };

    const renderCards = () => {
        if (isLoading) {
            return Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 sm:w-48">
                    <Skeleton className="aspect-[2/3] rounded-xl" />
                    <Skeleton className="h-4 w-3/4 mt-3" />
                    <Skeleton className="h-3 w-1/2 mt-2" />
                </div>
            ));
        }

        return items.map((item) => (
            <ContinueWatchingCard
                key={`${item.tmdbId}-${item.mediaType}`}
                item={item}
                onRemove={() => handleRemove(item.tmdbId, item.mediaType)}
                isPerformance={isPerformance}
            />
        ));
    };

    return (
        <section className="py-6 group/section">
            {/* Header */}
            <div className="container mx-auto px-4 flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <h2 className="text-xl md:text-2xl font-bold">Continue Watching</h2>
                </div>
            </div>

            {/* Scrollable Content with Navigation Overlay */}
            <div className="relative">
                {/* Mobile scroll indicators */}
                <div className="lg:hidden absolute left-0 top-0 bottom-8 z-10 w-4 bg-gradient-to-r from-background/80 to-transparent pointer-events-none" />
                <div className="lg:hidden absolute right-0 top-0 bottom-8 z-10 w-4 bg-gradient-to-l from-background/80 to-transparent pointer-events-none" />

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
