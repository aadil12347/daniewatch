import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Scroll optimization options
 */
interface ScrollOptimizationOptions {
    /** Throttle interval in milliseconds (default: 16ms ~ 60fps) */
    throttleMs?: number;
    /** Whether to use passive event listeners (default: true) */
    passive?: boolean;
    /** Whether to debounce the callback (default: false, uses throttle) */
    debounce?: boolean;
    /** Debounce wait time in milliseconds (default: 100ms) */
    debounceMs?: number;
}

/**
 * Optimized scroll hook with throttling/debouncing and requestAnimationFrame
 * 
 * Features:
 * - Passive event listeners for better scroll performance
 * - Throttling via requestAnimationFrame for smooth 60fps updates
 * - Debounce option for expensive operations
 * - Automatic cleanup on unmount
 * 
 * @example
 * ```tsx
 * const handleScroll = useOptimizedScroll((scrollY) => {
 *   // This callback is throttled to ~60fps
 *   setScrollProgress(scrollY / document.body.scrollHeight);
 * });
 * 
 * // Or with debounce for expensive operations
 * const handleScrollEnd = useOptimizedScroll((scrollY) => {
 *   saveScrollPosition(scrollY);
 * }, { debounce: true, debounceMs: 200 });
 * ```
 */
export function useOptimizedScroll(
    callback: (scrollY: number, event: Event) => void,
    options: ScrollOptimizationOptions = {}
) {
    const {
        throttleMs = 16, // ~60fps
        passive = true,
        debounce = false,
        debounceMs = 100,
    } = options;

    const rafRef = useRef<number | null>(null);
    const lastCallRef = useRef<number>(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callbackRef = useRef(callback);

    // Keep callback ref updated
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleScroll = useCallback(
        (event: Event) => {
            const scrollY = window.scrollY;

            if (debounce) {
                // Debounce mode: wait until scrolling stops
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                timeoutRef.current = setTimeout(() => {
                    callbackRef.current(scrollY, event);
                }, debounceMs);
            } else {
                // Throttle mode: limit calls to throttleMs interval
                const now = performance.now();
                const timeSinceLastCall = now - lastCallRef.current;

                if (timeSinceLastCall >= throttleMs) {
                    // Enough time has passed, call immediately
                    lastCallRef.current = now;
                    callbackRef.current(scrollY, event);
                } else {
                    // Schedule via RAF for smooth updates
                    if (rafRef.current) {
                        cancelAnimationFrame(rafRef.current);
                    }
                    rafRef.current = requestAnimationFrame(() => {
                        lastCallRef.current = performance.now();
                        callbackRef.current(window.scrollY, event);
                    });
                }
            }
        },
        [throttleMs, debounce, debounceMs]
    );

    useEffect(() => {
        // Use passive listener for better scroll performance
        window.addEventListener("scroll", handleScroll, { passive });

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, [handleScroll, passive]);

    return handleScroll;
}

/**
 * Hook to track scroll direction with optimized performance
 */
export function useScrollDirection(options: { threshold?: number } = {}) {
    const { threshold = 5 } = options;
    const lastScrollY = useRef(0);
    const [direction, setDirection] = useState<"up" | "down" | null>(null);

    useOptimizedScroll((scrollY) => {
        const diff = scrollY - lastScrollY.current;

        if (Math.abs(diff) < threshold) return;

        setDirection(diff > 0 ? "down" : "up");
        lastScrollY.current = scrollY;
    });

    return direction;
}

/**
 * Hook to check if user has scrolled past a threshold
 */
export function useScrolledPast(threshold: number = 0) {
    const [hasScrolled, setHasScrolled] = useState(false);

    useOptimizedScroll((scrollY) => {
        setHasScrolled(scrollY > threshold);
    });

    return hasScrolled;
}
