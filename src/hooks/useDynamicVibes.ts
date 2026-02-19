/**
 * useDynamicVibes Hook
 * Manages dynamic color themes based on movie posters.
 * 
 * Features:
 * - Respects Performance Mode (disabled in performance mode)
 * - Uses requestIdleCallback for non-blocking extraction
 * - Debounced extraction on hover
 * - Persistent caching
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePerformanceMode } from '@/contexts/PerformanceModeContext';
import {
    extractVibeFromImage,
    applyVibeToRoot,
    resetToDefaultVibe,
    getCachedVibe,
    preloadVibe,
    ExtractedVibe,
    DEFAULT_VIBE,
} from '@/lib/dynamicVibes';

interface UseDynamicVibesOptions {
    /** Enable hover preloading (default: true in quality mode) */
    enableHoverPreload?: boolean;
    /** Debounce time for hover extraction in ms (default: 200) */
    hoverDebounceMs?: number;
    /** Whether to animate color transitions (default: true) */
    animate?: boolean;
}

interface UseDynamicVibesReturn {
    /** Current active vibe */
    currentVibe: ExtractedVibe;
    /** Whether a vibe is being extracted */
    isExtracting: boolean;
    /** Extract and apply vibe from an image */
    extractAndApply: (imageUrl: string, cacheKey: string) => Promise<void>;
    /** Reset to default cinema red */
    reset: () => void;
    /** Preload vibe on hover (debounced) */
    handleHoverPreload: (posterPath: string | null | undefined, movieId: number | string) => void;
    /** Whether dynamic vibes is enabled (false in performance mode) */
    isEnabled: boolean;
}

// requestIdleCallback polyfill for Safari
const requestIdleCallbackPolyfill = (
    callback: IdleRequestCallback,
    _options?: IdleRequestOptions
): number => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        return (window as Window & { requestIdleCallback: typeof requestIdleCallback }).requestIdleCallback(callback);
    }
    // Fallback: just use setTimeout
    return setTimeout(() => {
        const start = Date.now();
        callback({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
        });
    }, 1) as unknown as number;
};

const cancelIdleCallbackPolyfill = (id: number) => {
    if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
    } else {
        clearTimeout(id);
    }
};

export function useDynamicVibes(options: UseDynamicVibesOptions = {}): UseDynamicVibesReturn {
    const {
        enableHoverPreload = true,
        hoverDebounceMs = 200,
        animate = true,
    } = options;

    const { isPerformance } = usePerformanceMode();
    const [currentVibe, setCurrentVibe] = useState<ExtractedVibe>(DEFAULT_VIBE);
    const [isExtracting, setIsExtracting] = useState(false);

    // Refs for debouncing and idle callbacks
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleCallbackRef = useRef<number | null>(null);
    const currentExtractionRef = useRef<string | null>(null);

    // Dynamic vibes is disabled in performance mode
    const isEnabled = !isPerformance;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
            if (idleCallbackRef.current) {
                cancelIdleCallbackPolyfill(idleCallbackRef.current);
            }
        };
    }, []);

    /**
     * Extract and apply vibe from an image
     */
    const extractAndApply = useCallback(
        async (imageUrl: string, cacheKey: string) => {
            // Skip if disabled or already extracting this key
            if (!isEnabled) return;
            if (currentExtractionRef.current === cacheKey && isExtracting) return;

            // Check cache first
            const cached = getCachedVibe(cacheKey);
            if (cached) {
                setCurrentVibe(cached);
                applyVibeToRoot(cached, animate);
                return;
            }

            currentExtractionRef.current = cacheKey;
            setIsExtracting(true);

            try {
                // Use requestIdleCallback for non-blocking extraction
                await new Promise<void>((resolve) => {
                    requestIdleCallbackPolyfill(async () => {
                        try {
                            const vibe = await extractVibeFromImage(imageUrl, cacheKey);
                            setCurrentVibe(vibe);
                            applyVibeToRoot(vibe, animate);
                            resolve();
                        } catch (error) {
                            console.warn('[useDynamicVibes] Extraction failed:', error);
                            resolve();
                        }
                    });
                });
            } finally {
                setIsExtracting(false);
                currentExtractionRef.current = null;
            }
        },
        [isEnabled, isExtracting, animate]
    );

    /**
     * Reset to default cinema red
     */
    const reset = useCallback(() => {
        setCurrentVibe(DEFAULT_VIBE);
        resetToDefaultVibe(animate);
    }, [animate]);

    /**
     * Handle hover preload with debouncing
     */
    const handleHoverPreload = useCallback(
        (posterPath: string | null | undefined, movieId: number | string) => {
            if (!isEnabled || !enableHoverPreload || !posterPath) return;

            // Clear previous timeout
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }

            // Debounce the preload
            hoverTimeoutRef.current = setTimeout(() => {
                preloadVibe(posterPath, movieId);
            }, hoverDebounceMs);
        },
        [isEnabled, enableHoverPreload, hoverDebounceMs]
    );

    return {
        currentVibe,
        isExtracting,
        extractAndApply,
        reset,
        handleHoverPreload,
        isEnabled,
    };
}

/**
 * Simple hook for page-level vibe application
 * Use this in detail pages (MovieDetails, TVDetails)
 */
export function usePageVibe(
    posterPath: string | null | undefined,
    contentId: number | string,
    enabled: boolean = true
) {
    const { isPerformance } = usePerformanceMode();
    const hasAppliedRef = useRef(false);

    useEffect(() => {
        // Skip if disabled, in performance mode, or no poster
        if (!enabled || isPerformance || !posterPath) {
            // Reset to default if we had previously applied a vibe
            if (hasAppliedRef.current) {
                resetToDefaultVibe(true);
                hasAppliedRef.current = false;
            }
            return;
        }

        const cacheKey = `${contentId}_${posterPath}`;

        // Check cache first for instant application
        const cached = getCachedVibe(cacheKey);
        if (cached) {
            applyVibeToRoot(cached, true);
            hasAppliedRef.current = true;
            return;
        }

        // Build image URL
        const imageUrl = posterPath.startsWith('http')
            ? posterPath
            : `https://image.tmdb.org/t/p/w92${posterPath}`;

        // Extract and apply using requestIdleCallback
        const idleId = requestIdleCallbackPolyfill(async () => {
            const vibe = await extractVibeFromImage(imageUrl, cacheKey);
            applyVibeToRoot(vibe, true);
            hasAppliedRef.current = true;
        });

        return () => {
            cancelIdleCallbackPolyfill(idleId);
        };
    }, [posterPath, contentId, enabled, isPerformance]);

    // Reset vibe when component unmounts
    useEffect(() => {
        return () => {
            if (hasAppliedRef.current) {
                resetToDefaultVibe(true);
            }
        };
    }, []);
}
