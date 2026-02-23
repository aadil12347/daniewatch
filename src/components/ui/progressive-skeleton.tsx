import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";

/**
 * ProgressiveSkeleton - A skeleton loader with smooth fade-out transition
 * 
 * Features:
 * - Shimmer animation for loading state
 * - Smooth crossfade transition when content loads
 * - Configurable transition duration
 * - Support for different skeleton shapes
 */

interface ProgressiveSkeletonProps {
    /** Whether content is still loading */
    isLoading: boolean;
    /** Content to display when loaded */
    children: React.ReactNode;
    /** Skeleton className */
    skeletonClassName?: string;
    /** Container className */
    className?: string;
    /** Transition duration in ms */
    transitionDuration?: number;
    /** Delay before showing skeleton (prevents flash) */
    showDelay?: number;
    /** Called when skeleton fade-out completes */
    onTransitionComplete?: () => void;
}

export const ProgressiveSkeleton = ({
    isLoading,
    children,
    skeletonClassName,
    className,
    transitionDuration = 300,
    showDelay = 100,
    onTransitionComplete,
}: ProgressiveSkeletonProps) => {
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [contentReady, setContentReady] = useState(!isLoading);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Delay showing skeleton to prevent flash on fast loads
    useEffect(() => {
        if (isLoading) {
            timerRef.current = setTimeout(() => {
                setShowSkeleton(true);
            }, showDelay);
        } else {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            setShowSkeleton(false);
            setContentReady(true);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [isLoading, showDelay]);

    return (
        <div className={cn("relative", className)}>
            <AnimatePresence mode="wait" onExitComplete={onTransitionComplete}>
                {showSkeleton && (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: transitionDuration / 1000, ease: "easeOut" }}
                        className={cn(
                            "absolute inset-0 z-10 rounded-md skeleton-shimmer",
                            skeletonClassName
                        )}
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={false}
                animate={{ opacity: contentReady ? 1 : 0 }}
                transition={{ duration: transitionDuration / 1000, ease: "easeIn" }}
            >
                {children}
            </motion.div>
        </div>
    );
};

/**
 * PosterSkeleton - Specialized skeleton for movie posters
 * 
 * Dimensions match MovieCard exactly:
 * - Poster: aspect-[2/3] rounded-xl
 * - Title: font-medium text-sm (h-4 matches line-height)
 * - Year/Media: text-xs (h-3.5 matches line-height)
 */
interface PosterSkeletonProps {
    size?: "sm" | "md" | "lg";
    className?: string;
    showRank?: boolean;
}

export const PosterSkeleton = ({ size = "md", className, showRank = false }: PosterSkeletonProps) => {
    // Match MovieCard sizeClasses exactly
    const sizeClasses = {
        sm: "w-32 sm:w-36",
        md: "w-40 sm:w-48",
        lg: "w-48 sm:w-56",
    };

    return (
        <div className={cn("flex-shrink-0", showRank && "pl-6 sm:pl-10", className)}>
            {/* Rank placeholder - matches rank-number dimensions */}
            {showRank && (
                <div className="absolute left-0 bottom-12 z-0">
                    <div className="w-12 h-16 skeleton-shimmer rounded" />
                </div>
            )}

            <div className={sizeClasses[size]}>
                {/* Poster image skeleton - matches aspect-[2/3] rounded-xl */}
                <div className="aspect-[2/3] rounded-xl skeleton-shimmer" />

                {/* Text skeleton - matches MovieCard text layout exactly */}
                <div className="mt-3 px-1">
                    {/* Title: font-medium text-sm truncate -> h-4 matches line-height */}
                    <div className="h-4 w-3/4 skeleton-shimmer rounded" />
                    {/* Year and media type container: flex items-center gap-2 mt-1 */}
                    <div className="flex items-center gap-2 mt-1">
                        {/* Year: text-xs -> h-3.5 matches line-height */}
                        <div className="h-3.5 w-10 skeleton-shimmer rounded" />
                        {/* Media type: text-xs capitalize -> h-3.5 matches line-height */}
                        <div className="h-3.5 w-14 skeleton-shimmer rounded" />
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * ContentRowSkeleton - Skeleton for a row of content cards
 */
interface ContentRowSkeletonProps {
    count?: number;
    size?: "sm" | "md" | "lg";
    showRank?: boolean;
    title?: string;
}

export const ContentRowSkeleton = ({
    count = 8,
    size = "md",
    showRank = false,
    title
}: ContentRowSkeletonProps) => {
    return (
        <section className="py-6">
            {/* Title skeleton */}
            {title ? (
                <div className="container mx-auto px-4 mb-4">
                    <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
                </div>
            ) : (
                <div className="container mx-auto px-4 mb-4">
                    <div className="h-7 w-48 skeleton-shimmer rounded" />
                </div>
            )}

            {/* Cards skeleton */}
            <div className="flex gap-4 overflow-x-auto hide-scrollbar px-4 pb-10">
                {Array.from({ length: count }).map((_, i) => (
                    <PosterSkeleton key={i} size={size} showRank={showRank} />
                ))}
            </div>
        </section>
    );
};

/**
 * GridSkeleton - Skeleton for grid layouts (infinite scroll)
 * 
 * Dimensions match MovieCard exactly:
 * - Poster: aspect-[2/3] rounded-xl
 * - Title: font-medium text-sm (h-4 matches line-height)
 * - Year/Media: text-xs (h-3.5 matches line-height)
 */
interface GridSkeletonProps {
    count?: number;
    columns?: number;
    size?: "sm" | "md" | "lg";
}

export const GridSkeleton = ({
    count = 18,
    columns = 6,
    size = "md"
}: GridSkeletonProps) => {
    // Match MovieCard sizeClasses exactly
    const sizeClasses = {
        sm: "w-32 sm:w-36",
        md: "w-40 sm:w-48",
        lg: "w-48 sm:w-56",
    };

    return (
        <div
            className="grid gap-4 px-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={sizeClasses[size]}>
                    {/* Poster: aspect-[2/3] rounded-xl */}
                    <div className="aspect-[2/3] rounded-xl skeleton-shimmer" />
                    {/* Text: matches MovieCard text layout exactly */}
                    <div className="mt-3 px-1">
                        {/* Title: font-medium text-sm -> h-4 */}
                        <div className="h-4 w-3/4 skeleton-shimmer rounded" />
                        {/* Year and media type: text-xs -> h-3.5 */}
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-3.5 w-10 skeleton-shimmer rounded" />
                            <div className="h-3.5 w-14 skeleton-shimmer rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProgressiveSkeleton;

/**
 * InfiniteScrollLoadingIndicator - Loading spinner for infinite scroll
 * 
 * Displays at the bottom of the feed during infinite scroll events
 * on non-homepage pages to signal that more posts are being fetched.
 */
interface InfiniteScrollLoadingIndicatorProps {
    isLoading: boolean;
    className?: string;
}

export const InfiniteScrollLoadingIndicator = ({
    isLoading,
    className
}: InfiniteScrollLoadingIndicatorProps) => {
    if (!isLoading) return null;

    return (
        <div className={cn("py-8 flex flex-col items-center justify-center gap-3", className)}>
            {/* Spinner */}
            <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-muted" />
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            {/* Loading text */}
            <span className="text-sm text-muted-foreground animate-pulse">
                Loading more...
            </span>
        </div>
    );
};

/**
 * EndOfContentIndicator - UI element for end of content
 * 
 * Displays when the user reaches the final item in a list,
 * clearly indicating the conclusion of the content.
 */
interface EndOfContentIndicatorProps {
    hasMore: boolean;
    itemCount?: number;
    className?: string;
}

export const EndOfContentIndicator = ({
    hasMore,
    itemCount,
    className
}: EndOfContentIndicatorProps) => {
    // Only show when there are items and no more to load
    if (hasMore || itemCount === 0) return null;

    return (
        <div className={cn("py-10 flex flex-col items-center justify-center gap-3", className)}>
            {/* Decorative divider */}
            <div className="flex items-center gap-4 w-full max-w-xs">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
            {/* End message */}
            <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">
                    You've reached the end
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                    No more content to load
                </p>
            </div>
            {/* Decorative divider */}
            <div className="flex items-center gap-4 w-full max-w-xs">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
        </div>
    );
};

/**
 * InfiniteScrollFooter - Combined loading and end indicator
 * 
 * Combines the loading indicator and end of content indicator
 * into a single component for easy use at the bottom of feeds.
 */
interface InfiniteScrollFooterProps {
    isLoading: boolean;
    hasMore: boolean;
    itemCount: number;
    className?: string;
}

export const InfiniteScrollFooter = ({
    isLoading,
    hasMore,
    itemCount,
    className
}: InfiniteScrollFooterProps) => {
    return (
        <div className={className}>
            <InfiniteScrollLoadingIndicator isLoading={isLoading && hasMore} />
            <EndOfContentIndicator hasMore={hasMore} itemCount={itemCount} />
        </div>
    );
};
