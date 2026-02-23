import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Progressive Loading State
 * 
 * Tracks loading states for individual items in a collection,
 * enabling skeleton-to-content transitions on a per-item basis.
 */

export interface ProgressiveLoadingState<T> {
    /** All items (both loaded and loading) */
    items: T[];
    /** Set of item IDs that are still loading */
    loadingIds: Set<string | number>;
    /** Whether the initial load is in progress */
    isInitialLoading: boolean;
    /** Whether more items are being fetched */
    isLoadingMore: boolean;
    /** Whether there are more items to load */
    hasMore: boolean;
    /** Error state */
    error: Error | null;
}

export interface ProgressiveLoadingOptions<T> {
    /** Function to get unique ID from an item */
    getId: (item: T) => string | number;
    /** Initial items (e.g., from cache) */
    initialItems?: T[];
    /** IDs that should show as loading initially */
    initialLoadingIds?: (string | number)[];
    /** Delay before showing skeleton (prevents flash) */
    skeletonDelay?: number;
    /** Minimum time to show skeleton (prevents flash) */
    minSkeletonDuration?: number;
}

export interface ProgressiveLoadingActions<T> {
    /** Set all items at once (replaces existing) */
    setItems: (items: T[]) => void;
    /** Add items to existing list */
    appendItems: (items: T[]) => void;
    /** Prepend items to existing list */
    prependItems: (items: T[]) => void;
    /** Mark specific items as loaded */
    markAsLoaded: (ids: (string | number)[]) => void;
    /** Mark specific items as loading */
    markAsLoading: (ids: (string | number)[]) => void;
    /** Set initial loading state */
    setIsInitialLoading: (loading: boolean) => void;
    /** Set loading more state */
    setIsLoadingMore: (loading: boolean) => void;
    /** Set hasMore state */
    setHasMore: (hasMore: boolean) => void;
    /** Set error state */
    setError: (error: Error | null) => void;
    /** Remove items by ID */
    removeItems: (ids: (string | number)[]) => void;
    /** Update a single item */
    updateItem: (id: string | number, updates: Partial<T>) => void;
    /** Check if a specific item is loading */
    isItemLoading: (id: string | number) => boolean;
    /** Reset all state */
    reset: () => void;
}

export type UseProgressiveLoadingReturn<T> = ProgressiveLoadingState<T> & ProgressiveLoadingActions<T>;

/**
 * Hook for managing progressive loading states with per-item skeleton tracking
 */
export function useProgressiveLoading<T>(
    options: ProgressiveLoadingOptions<T>
): UseProgressiveLoadingReturn<T> {
    const {
        getId,
        initialItems = [],
        initialLoadingIds = [],
        skeletonDelay = 50,
        minSkeletonDuration = 200,
    } = options;

    const [items, setItemsState] = useState<T[]>(initialItems);
    const [loadingIds, setLoadingIds] = useState<Set<string | number>>(new Set(initialLoadingIds));
    const [isInitialLoading, setIsInitialLoadingState] = useState(initialLoadingIds.length > 0);
    const [isLoadingMore, setIsLoadingMoreState] = useState(false);
    const [hasMore, setHasMoreState] = useState(true);
    const [error, setErrorState] = useState<Error | null>(null);

    // Track when items started loading for minimum duration enforcement
    const loadingStartTimes = useRef<Map<string | number, number>>(new Map());
    const skeletonTimers = useRef<Map<string | number, ReturnType<typeof setTimeout>>>(new Map());

    // Clean up timers on unmount
    useEffect(() => {
        return () => {
            skeletonTimers.current.forEach((timer) => clearTimeout(timer));
        };
    }, []);

    const setItems = useCallback((newItems: T[]) => {
        setItemsState(newItems);
        // Clear all loading states when setting all items
        setLoadingIds(new Set());
        loadingStartTimes.current.clear();
        skeletonTimers.current.forEach((timer) => clearTimeout(timer));
        skeletonTimers.current.clear();
    }, []);

    const appendItems = useCallback((newItems: T[]) => {
        setItemsState((prev) => [...prev, ...newItems]);
    }, []);

    const prependItems = useCallback((newItems: T[]) => {
        setItemsState((prev) => [...newItems, ...prev]);
    }, []);

    const markAsLoaded = useCallback((ids: (string | number)[]) => {
        const now = Date.now();
        const idsToProcess = [...ids];

        // Check minimum skeleton duration for each ID
        const processId = (id: string | number) => {
            const startTime = loadingStartTimes.current.get(id);
            const elapsed = startTime ? now - startTime : minSkeletonDuration;

            if (elapsed >= minSkeletonDuration) {
                // Enough time has passed, mark as loaded immediately
                setLoadingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                loadingStartTimes.current.delete(id);
            } else {
                // Wait for minimum duration
                const remaining = minSkeletonDuration - elapsed;
                const timer = setTimeout(() => {
                    setLoadingIds((prev) => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                    loadingStartTimes.current.delete(id);
                    skeletonTimers.current.delete(id);
                }, remaining);

                skeletonTimers.current.set(id, timer);
            }
        };

        idsToProcess.forEach((id) => processId(id));
    }, [minSkeletonDuration]);

    const markAsLoading = useCallback((ids: (string | number)[]) => {
        const now = Date.now();

        setLoadingIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => {
                next.add(id);
                loadingStartTimes.current.set(id, now);
            });
            return next;
        });
    }, []);

    const setIsInitialLoading = useCallback((loading: boolean) => {
        setIsInitialLoadingState(loading);
    }, []);

    const setIsLoadingMore = useCallback((loading: boolean) => {
        setIsLoadingMoreState(loading);
    }, []);

    const setHasMore = useCallback((more: boolean) => {
        setHasMoreState(more);
    }, []);

    const setError = useCallback((err: Error | null) => {
        setErrorState(err);
    }, []);

    const removeItems = useCallback((ids: (string | number)[]) => {
        const idSet = new Set(ids);
        setItemsState((prev) => prev.filter((item) => !idSet.has(getId(item))));
        setLoadingIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
        });
    }, [getId]);

    const updateItem = useCallback((id: string | number, updates: Partial<T>) => {
        setItemsState((prev) =>
            prev.map((item) => (getId(item) === id ? { ...item, ...updates } : item))
        );
    }, [getId]);

    const isItemLoading = useCallback((id: string | number) => {
        return loadingIds.has(id);
    }, [loadingIds]);

    const reset = useCallback(() => {
        setItemsState([]);
        setLoadingIds(new Set());
        setIsInitialLoadingState(false);
        setIsLoadingMoreState(false);
        setHasMoreState(true);
        setErrorState(null);
        loadingStartTimes.current.clear();
        skeletonTimers.current.forEach((timer) => clearTimeout(timer));
        skeletonTimers.current.clear();
    }, []);

    return {
        items,
        loadingIds,
        isInitialLoading,
        isLoadingMore,
        hasMore,
        error,
        setItems,
        appendItems,
        prependItems,
        markAsLoaded,
        markAsLoading,
        setIsInitialLoading,
        setIsLoadingMore,
        setHasMore,
        setError,
        removeItems,
        updateItem,
        isItemLoading,
        reset,
    };
}

/**
 * Hook for preloading HTML structure for infinite scroll
 * 
 * Pre-renders skeleton structures for items that will appear soon,
 * ensuring instant rendering when the user scrolls to them.
 * 
 * Note: For full infinite scroll functionality with data fetching,
 * use useInfiniteScrollPreload from ./useInfiniteScrollPreload instead.
 */
export interface PreloadConfig {
    /** Number of items to preload ahead */
    preloadCount: number;
    /** Threshold to trigger preload (as ratio of viewport) */
    threshold: number;
    /** Debounce time for preload triggers */
    debounceMs: number;
}

export function useScrollPreload<T>(
    items: T[],
    config: Partial<PreloadConfig> = {}
) {
    const {
        preloadCount = 10,
        threshold = 0.8,
        debounceMs = 100,
    } = config;

    const [preloadedCount, setPreloadedCount] = useState(0);
    const lastPreloadIndex = useRef(0);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Calculate how many items should be preloaded based on scroll position
    const updatePreloadCount = useCallback(() => {
        const scrollPosition = window.scrollY;
        const viewportHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        const scrollRatio = (scrollPosition + viewportHeight) / documentHeight;

        if (scrollRatio >= threshold) {
            const newPreloadedCount = Math.min(
                items.length,
                lastPreloadIndex.current + preloadCount
            );

            if (newPreloadedCount > preloadedCount) {
                setPreloadedCount(newPreloadedCount);
                lastPreloadIndex.current = newPreloadedCount;
            }
        }
    }, [items.length, preloadCount, threshold, preloadedCount]);

    // Debounced scroll handler
    useEffect(() => {
        const handleScroll = () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
            debounceTimer.current = setTimeout(updatePreloadCount, debounceMs);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });

        // Initial check
        updatePreloadCount();

        return () => {
            window.removeEventListener("scroll", handleScroll);
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [updatePreloadCount, debounceMs]);

    return {
        preloadedCount,
        setPreloadedCount,
    };
}

/**
 * Hook for tracking image loading states with skeleton transitions
 */
export function useImageSkeleton(src: string | null | undefined) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        if (!src) {
            setIsLoaded(false);
            setHasError(false);
            return;
        }

        // Reset state for new src
        setIsLoaded(false);
        setHasError(false);

        // Check if image is already cached
        const img = new Image();
        imgRef.current = img;

        img.onload = () => {
            setIsLoaded(true);
        };

        img.onerror = () => {
            setHasError(true);
        };

        img.src = src;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [src]);

    return {
        isLoaded,
        hasError,
        showSkeleton: !isLoaded && !hasError && !!src,
    };
}

export default useProgressiveLoading;
