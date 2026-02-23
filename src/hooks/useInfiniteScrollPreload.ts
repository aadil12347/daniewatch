import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/**
 * Infinite Scroll with Progressive Preloading
 * 
 * This hook manages infinite scrolling with pre-loaded HTML structures:
 * 1. Pre-renders skeleton structures for items that will appear soon
 * 2. Tracks scroll position to predict which items user will see next
 * 3. Ensures instant rendering when user scrolls to pre-loaded items
 */

export interface InfiniteScrollConfig {
    /** Number of items per page/batch */
    batchSize: number;
    /** Number of batches to preload ahead */
    preloadBatches: number;
    /** Root margin for intersection observer */
    rootMargin: string;
    /** Threshold for triggering load more */
    threshold: number;
    /** Debounce time for scroll events */
    debounceMs: number;
}

export interface InfiniteScrollState<T> {
    /** All loaded items */
    items: T[];
    /** Items currently visible in viewport */
    visibleItems: T[];
    /** Items preloaded but not yet visible */
    preloadedItems: T[];
    /** Skeleton items for upcoming content */
    skeletonCount: number;
    /** Current page/batch index */
    currentPage: number;
    /** Whether initial load is in progress */
    isLoading: boolean;
    /** Whether more items are being fetched */
    isLoadingMore: boolean;
    /** Whether there are more items to load */
    hasMore: boolean;
    /** Error state */
    error: Error | null;
}

export interface InfiniteScrollActions<T> {
    /** Load next batch of items */
    loadMore: () => Promise<void>;
    /** Reset to initial state */
    reset: () => void;
    /** Manually set items (for cache restoration) */
    setItems: (items: T[], page: number) => void;
    /** Append items to existing list */
    appendItems: (items: T[]) => void;
    /** Set loading state */
    setLoading: (loading: boolean) => void;
    /** Set hasMore state */
    setHasMore: (hasMore: boolean) => void;
    /** Get item at specific index */
    getItemAt: (index: number) => T | undefined;
    /** Check if index is preloaded */
    isPreloaded: (index: number) => boolean;
}

export type UseInfiniteScrollReturn<T> = InfiniteScrollState<T> & InfiniteScrollActions<T> & {
    /** Ref to attach to load more trigger element */
    loadMoreRef: React.RefObject<HTMLDivElement>;
    /** Ref to attach to scroll container */
    containerRef: React.RefObject<HTMLDivElement>;
};

const DEFAULT_CONFIG: InfiniteScrollConfig = {
    batchSize: 20,
    preloadBatches: 2,
    rootMargin: "400px",
    threshold: 0.1,
    debounceMs: 100,
};

/**
 * Hook for infinite scroll with progressive preloading
 */
export function useInfiniteScrollPreload<T>(
    fetchFn: (page: number, batchSize: number) => Promise<{ items: T[]; hasMore: boolean }>,
    config: Partial<InfiniteScrollConfig> = {}
): UseInfiniteScrollReturn<T> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const { batchSize, preloadBatches, rootMargin, threshold, debounceMs } = finalConfig;

    const [items, setItems] = useState<T[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: batchSize });

    const loadMoreRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isLoadingRef = useRef(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate preloaded items and skeleton count
    const { visibleItems, preloadedItems, skeletonCount } = useMemo(() => {
        const visibleItems = items.slice(visibleRange.start, visibleRange.end);
        const preloadedEnd = Math.min(items.length, visibleRange.end + batchSize * preloadBatches);
        const preloadedItems = items.slice(visibleRange.end, preloadedEnd);

        // Calculate skeletons needed for items not yet loaded
        const totalExpected = visibleRange.end + batchSize * preloadBatches;
        const skeletonCount = Math.max(0, totalExpected - items.length);

        return { visibleItems, preloadedItems, skeletonCount };
    }, [items, visibleRange, batchSize, preloadBatches]);

    // Fetch function with deduplication
    const loadMore = useCallback(async () => {
        if (isLoadingRef.current || !hasMore) return;

        isLoadingRef.current = true;

        if (items.length === 0) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const nextPage = currentPage + 1;
            const result = await fetchFn(nextPage, batchSize);

            setItems((prev) => [...prev, ...result.items]);
            setCurrentPage(nextPage);
            setHasMore(result.hasMore);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
            isLoadingRef.current = false;
        }
    }, [fetchFn, batchSize, currentPage, hasMore, items.length]);

    // Intersection observer for load more trigger
    useEffect(() => {
        const trigger = loadMoreRef.current;
        if (!trigger) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry?.isIntersecting && hasMore && !isLoadingRef.current) {
                    loadMore();
                }
            },
            { rootMargin, threshold }
        );

        observer.observe(trigger);
        return () => observer.disconnect();
    }, [loadMore, hasMore, rootMargin, threshold]);

    // Track visible range based on scroll position
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateVisibleRange = () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(() => {
                const rect = container.getBoundingClientRect();
                const itemHeight = rect.height / Math.min(items.length, batchSize);

                const scrollTop = window.scrollY;
                const viewportHeight = window.innerHeight;

                const start = Math.max(0, Math.floor(scrollTop / itemHeight));
                const end = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + batchSize);

                setVisibleRange({ start, end });
            }, debounceMs);
        };

        window.addEventListener("scroll", updateVisibleRange, { passive: true });
        updateVisibleRange();

        return () => {
            window.removeEventListener("scroll", updateVisibleRange);
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [items.length, batchSize, debounceMs]);

    // Actions
    const reset = useCallback(() => {
        setItems([]);
        setCurrentPage(0);
        setIsLoading(false);
        setIsLoadingMore(false);
        setHasMore(true);
        setError(null);
        setVisibleRange({ start: 0, end: batchSize });
        isLoadingRef.current = false;
    }, [batchSize]);

    const setItemsManually = useCallback((newItems: T[], page: number) => {
        setItems(newItems);
        setCurrentPage(page);
        setIsLoading(false);
        setIsLoadingMore(false);
    }, []);

    const appendItemsManually = useCallback((newItems: T[]) => {
        setItems((prev) => [...prev, ...newItems]);
    }, []);

    const setLoading = useCallback((loading: boolean) => {
        setIsLoading(loading);
        if (!loading) {
            isLoadingRef.current = false;
        }
    }, []);

    const setHasMoreManually = useCallback((more: boolean) => {
        setHasMore(more);
    }, []);

    const getItemAt = useCallback((index: number) => {
        return items[index];
    }, [items]);

    const isPreloaded = useCallback((index: number) => {
        return index < items.length;
    }, [items.length]);

    return {
        items,
        visibleItems,
        preloadedItems,
        skeletonCount,
        currentPage,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        loadMore,
        reset,
        setItems: setItemsManually,
        appendItems: appendItemsManually,
        setLoading,
        setHasMore: setHasMoreManually,
        getItemAt,
        isPreloaded,
        loadMoreRef,
        containerRef,
    };
}

/**
 * Hook for preloading HTML structure for upcoming items
 * 
 * This creates placeholder DOM elements for items that will appear
 * when the user scrolls, ensuring instant rendering.
 */
export function useHtmlPreload<T>(
    items: T[],
    getId: (item: T) => string | number,
    options: {
        preloadCount: number;
        containerRef: React.RefObject<HTMLElement>;
    }
) {
    const { preloadCount, containerRef } = options;
    const [preloadedIds, setPreloadedIds] = useState<Set<string | number>>(new Set());
    const lastPreloadIndexRef = useRef(0);

    // Preload HTML structure for upcoming items
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute("data-preload-id");
                        if (id) {
                            setPreloadedIds((prev) => new Set(prev).add(id));
                        }
                    }
                });
            },
            { rootMargin: "400px", threshold: 0.01 }
        );

        // Observe items near the end of visible range
        const itemElements = container.querySelectorAll("[data-preload-id]");
        itemElements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, [items, containerRef]);

    // Calculate which items should have preloaded HTML
    const getPreloadState = useCallback((index: number, id: string | number) => {
        const isPreloaded = preloadedIds.has(id);
        const shouldPreload = index >= lastPreloadIndexRef.current && index < lastPreloadIndexRef.current + preloadCount;

        return {
            isPreloaded,
            shouldPreload,
        };
    }, [preloadedIds, preloadCount]);

    return {
        preloadedIds,
        getPreloadState,
    };
}

/**
 * Hook for managing skeleton placeholders during data fetch
 */
export function useSkeletonManager(
    expectedCount: number,
    loadedCount: number,
    options: {
        minSkeletonDuration?: number;
        fadeOutDuration?: number;
    } = {}
) {
    const { minSkeletonDuration = 200, fadeOutDuration = 300 } = options;
    const [skeletonIndices, setSkeletonIndices] = useState<Set<number>>(new Set());
    const loadStartTimes = useRef<Map<number, number>>(new Map());
    // Track previous counts to prevent infinite re-renders
    const prevCountsRef = useRef({ expected: 0, loaded: 0 });

    // Initialize skeletons for expected items
    useEffect(() => {
        const { expected: prevExpected, loaded: prevLoaded } = prevCountsRef.current;

        // Skip if counts haven't changed
        if (expectedCount === prevExpected && loadedCount === prevLoaded) return;

        prevCountsRef.current = { expected: expectedCount, loaded: loadedCount };

        const newSkeletons = new Set<number>();
        for (let i = loadedCount; i < expectedCount; i++) {
            loadStartTimes.current.set(i, Date.now());
            newSkeletons.add(i);
        }

        if (newSkeletons.size > 0) {
            setSkeletonIndices((prev) => new Set([...prev, ...newSkeletons]));
        }
    }, [expectedCount, loadedCount]);

    // Remove skeleton when item loads
    const markItemLoaded = useCallback((index: number) => {
        const startTime = loadStartTimes.current.get(index) || Date.now();
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minSkeletonDuration - elapsed);

        setTimeout(() => {
            setSkeletonIndices((prev) => {
                const next = new Set(prev);
                next.delete(index);
                return next;
            });
            loadStartTimes.current.delete(index);
        }, remaining + fadeOutDuration);
    }, [minSkeletonDuration, fadeOutDuration]);

    // Check if index should show skeleton
    const shouldShowSkeleton = useCallback((index: number) => {
        return skeletonIndices.has(index);
    }, [skeletonIndices]);

    return {
        skeletonIndices,
        shouldShowSkeleton,
        markItemLoaded,
    };
}

export default useInfiniteScrollPreload;
