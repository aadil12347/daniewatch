import { useState, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MovieCard } from "./MovieCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Movie } from "@/lib/tmdb";

/**
 * ProgressiveMovieCard
 * 
 * Wraps MovieCard with progressive rendering:
 * 1. Instantly displays static HTML structure (title, year, media type)
 * 2. Shows skeleton placeholder for poster until image loads
 * 3. Smooth crossfade transition from skeleton to actual poster
 * 
 * This enables instant perceived load time while media assets load asynchronously.
 */

// Define props interface locally since MovieCardProps is not exported
export interface ProgressiveMovieCardProps {
    movie: Movie;
    index?: number;
    showRank?: boolean;
    size?: "sm" | "md" | "lg";
    animationDelay?: number;
    className?: string;
    enableReveal?: boolean;
    enableHoverPortal?: boolean;
    hoverCharacterMode?: "popout" | "contained";
    disableHoverCharacter?: boolean;
    disableHoverLogo?: boolean;
    disableRankFillHover?: boolean;
    /** Force skeleton state (for pre-loading HTML structure) */
    forceSkeleton?: boolean;
    /** Minimum time to show skeleton (prevents flash) */
    minSkeletonDuration?: number;
    /** Delay before showing skeleton (prevents flash on fast loads) */
    skeletonDelay?: number;
    /** Callback when poster finishes loading */
    onPosterLoad?: () => void;
}

// Skeleton component for poster placeholder
const PosterSkeletonLayer = memo(({
    size = "md",
    isActive
}: {
    size?: "sm" | "md" | "lg";
    isActive: boolean;
}) => {
    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: isActive ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute inset-0 z-10"
        >
            <div className="w-full h-full skeleton-shimmer rounded-xl" />
        </motion.div>
    );
});

PosterSkeletonLayer.displayName = "PosterSkeletonLayer";

export const ProgressiveMovieCard = memo(({
    movie,
    forceSkeleton = false,
    minSkeletonDuration = 150,
    skeletonDelay = 50,
    onPosterLoad,
    ...movieCardProps
}: ProgressiveMovieCardProps) => {
    const [showSkeleton, setShowSkeleton] = useState(true);
    const [posterLoaded, setPosterLoaded] = useState(false);
    const loadStartTime = useRef<number>(Date.now());
    const skeletonTimerRef = useRef<NodeJS.Timeout | null>(null);
    const delayTimerRef = useRef<NodeJS.Timeout | null>(null);

    const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
    const title = movie.title || movie.name || "Unknown";
    const year = (movie.release_date || movie.first_air_date || "").split("-")[0] || "—";

    // Clean up timers on unmount
    useEffect(() => {
        return () => {
            if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
            if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
        };
    }, []);

    // Handle poster load completion
    const handlePosterLoad = () => {
        const elapsed = Date.now() - loadStartTime.current;
        const remaining = Math.max(0, minSkeletonDuration - elapsed);

        // Ensure minimum skeleton duration
        if (remaining > 0) {
            skeletonTimerRef.current = setTimeout(() => {
                setShowSkeleton(false);
                setPosterLoaded(true);
                onPosterLoad?.();
            }, remaining);
        } else {
            setShowSkeleton(false);
            setPosterLoaded(true);
            onPosterLoad?.();
        }
    };

    // If forcing skeleton, keep it visible
    useEffect(() => {
        if (forceSkeleton) {
            setShowSkeleton(true);
            setPosterLoaded(false);
            loadStartTime.current = Date.now();
        }
    }, [forceSkeleton]);

    // Delay showing skeleton to prevent flash on fast loads
    useEffect(() => {
        if (forceSkeleton) {
            delayTimerRef.current = setTimeout(() => {
                setShowSkeleton(true);
            }, skeletonDelay);
        }

        return () => {
            if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
        };
    }, [forceSkeleton, skeletonDelay]);

    return (
        <div className="relative">
            {/* Skeleton layer - shows while poster loads */}
            <AnimatePresence>
                {(showSkeleton || forceSkeleton) && !posterLoaded && (
                    <PosterSkeletonLayer
                        size={movieCardProps.size}
                        isActive={showSkeleton || forceSkeleton}
                    />
                )}
            </AnimatePresence>

            {/* Actual MovieCard with poster - passes onPosterLoad to track loading */}
            <div
                className={cn(
                    "transition-opacity duration-300",
                    (showSkeleton || forceSkeleton) && !posterLoaded && "opacity-0"
                )}
            >
                <MovieCard
                    movie={movie}
                    {...movieCardProps}
                    onPosterLoad={handlePosterLoad}
                />
            </div>
        </div>
    );
});

ProgressiveMovieCard.displayName = "ProgressiveMovieCard";

/**
 * ProgressiveMovieCardGrid
 * 
 * Grid component that pre-loads HTML structure for subsequent posts
 * to ensure immediate rendering upon scrolling.
 */
export interface ProgressiveMovieCardGridProps {
    movies: Movie[];
    isLoading?: boolean;
    loadingIds?: Set<string | number>;
    showRank?: boolean;
    size?: "sm" | "md" | "lg";
    enableReveal?: boolean;
    enableHoverPortal?: boolean;
    hoverCharacterMode?: "popout" | "contained";
    preloadCount?: number;
    onItemVisible?: (id: number) => void;
}

export const ProgressiveMovieCardGrid = memo(({
    movies,
    isLoading = false,
    loadingIds = new Set(),
    showRank = false,
    size = "md",
    enableReveal = false,
    enableHoverPortal = false,
    hoverCharacterMode = "contained",
    preloadCount = 6,
    onItemVisible,
}: ProgressiveMovieCardGridProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const visibleItemsRef = useRef<Set<number>>(new Set());

    // Intersection observer for visibility tracking
    useEffect(() => {
        if (!containerRef.current || !onItemVisible) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const id = Number(entry.target.getAttribute("data-movie-id"));
                    if (entry.isIntersecting && !visibleItemsRef.current.has(id)) {
                        visibleItemsRef.current.add(id);
                        onItemVisible(id);
                    }
                });
            },
            { rootMargin: "200px", threshold: 0.01 }
        );

        const items = containerRef.current.querySelectorAll("[data-movie-id]");
        items.forEach((item) => observer.observe(item));

        return () => observer.disconnect();
    }, [movies, onItemVisible]);

    // Render loading skeletons - dimensions match MovieCard exactly
    if (isLoading && movies.length === 0) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 px-4">
                {Array.from({ length: preloadCount }).map((_, i) => (
                    <div key={i} className="flex-shrink-0">
                        {/* Poster: aspect-[2/3] rounded-xl */}
                        <Skeleton className="aspect-[2/3] rounded-xl" />
                        {/* Text: matches MovieCard text layout exactly */}
                        <div className="mt-3 px-1">
                            {/* Title: font-medium text-sm -> h-4 */}
                            <Skeleton className="h-4 w-3/4" />
                            {/* Year and media type: text-xs -> h-3.5 */}
                            <div className="flex items-center gap-2 mt-1">
                                <Skeleton className="h-3.5 w-10" />
                                <Skeleton className="h-3.5 w-14" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 px-4"
        >
            {movies.map((movie, idx) => {
                const movieId = movie.id;
                const isItemLoading = loadingIds.has(movieId);

                return (
                    <div key={movieId} data-movie-id={movieId}>
                        <ProgressiveMovieCard
                            movie={movie}
                            index={idx}
                            showRank={showRank}
                            size={size}
                            enableReveal={enableReveal}
                            enableHoverPortal={enableHoverPortal}
                            hoverCharacterMode={hoverCharacterMode}
                            forceSkeleton={isItemLoading}
                        />
                    </div>
                );
            })}
        </div>
    );
});

ProgressiveMovieCardGrid.displayName = "ProgressiveMovieCardGrid";

export default ProgressiveMovieCard;
