import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Global loader overlay shown during route changes + while network requests are in flight.
 *
 * UX rules:
 * - minimum visible time: 1.5s (prevents flicker/glitch)
 * - maximum visible time: 10s (never blocks UI forever)
 * - fade in/out transition
 */
export function GlobalRouteLoader() {
  const location = useLocation();

  const MIN_VISIBLE_MS = 1500;
  const MAX_VISIBLE_MS = 10000;
  const FADE_OUT_MS = 200;

  const [inflight, setInflight] = useState(0);
  const [routePending, setRoutePending] = useState(false);
  const [docPending, setDocPending] = useState(() => document.readyState !== "complete");

  // Controls mount + fade.
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const currentRouteKey = useMemo(() => location.pathname + location.search, [location.pathname, location.search]);
  const lastRouteKeyRef = useRef(currentRouteKey);

  const prevWantedRef = useRef(false);
  const cycleIdRef = useRef(0);
  const shownAtRef = useRef(0);

  const hardTimeoutRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (hardTimeoutRef.current) {
      window.clearTimeout(hardTimeoutRef.current);
      hardTimeoutRef.current = null;
    }
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (unmountTimerRef.current) {
      window.clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
  };

  // Track initial document load
  useEffect(() => {
    if (document.readyState === "complete") return;
    const onLoad = () => setDocPending(false);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Patch fetch to know when content is still loading.
  useEffect(() => {
    const originalFetch = window.fetch;
    let mounted = true;

    window.fetch = (async (...args: Parameters<typeof originalFetch>) => {
      if (mounted) setInflight((v) => v + 1);
      try {
        return await originalFetch(...args);
      } finally {
        if (mounted) setInflight((v) => Math.max(0, v - 1));
      }
    }) as typeof window.fetch;

    return () => {
      mounted = false;
      window.fetch = originalFetch;
    };
  }, []);

  // Mark navigation as pending immediately when route changes.
  useEffect(() => {
    if (lastRouteKeyRef.current !== currentRouteKey) {
      lastRouteKeyRef.current = currentRouteKey;
      setRoutePending(true);
      // New route = new loader cycle, so allow showing again even if the previous one timed out.
      setTimedOut(false);
    }
  }, [currentRouteKey]);

  // If everything is settled, clear timeout suppression so the next load can show normally.
  const rawWanted = docPending || routePending || inflight > 0;
  useEffect(() => {
    if (!rawWanted && timedOut) setTimedOut(false);
  }, [rawWanted, timedOut]);

  // Clear pending state once there are no requests left.
  useEffect(() => {
    if (!routePending) return;
    if (inflight > 0) return;

    // Let the new page paint first, then hide.
    const raf = requestAnimationFrame(() => setRoutePending(false));
    return () => cancelAnimationFrame(raf);
  }, [inflight, routePending]);

  const wanted = rawWanted && !timedOut;

  const beginShow = () => {
    clearTimers();

    cycleIdRef.current += 1;
    const myCycle = cycleIdRef.current;

    shownAtRef.current = Date.now();

    setIsMounted(true);
    // Ensure CSS transition kicks in after mount.
    requestAnimationFrame(() => setIsOpen(true));

    hardTimeoutRef.current = window.setTimeout(() => {
      // Only apply to the current cycle.
      if (cycleIdRef.current !== myCycle) return;

      setTimedOut(true);

      // Hide after minimum time (even if still loading).
      const elapsed = Date.now() - shownAtRef.current;
      const remainingMin = Math.max(0, MIN_VISIBLE_MS - elapsed);

      hideTimerRef.current = window.setTimeout(() => {
        setIsOpen(false);
        unmountTimerRef.current = window.setTimeout(() => setIsMounted(false), FADE_OUT_MS);
      }, remainingMin);
    }, MAX_VISIBLE_MS);
  };

  const beginHide = () => {
    clearTimers();

    const elapsed = Date.now() - shownAtRef.current;
    const remainingMin = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      unmountTimerRef.current = window.setTimeout(() => setIsMounted(false), FADE_OUT_MS);
    }, remainingMin);
  };

  // Mount/unmount with min duration, and enforce hard timeout.
  useEffect(() => {
    const prev = prevWantedRef.current;
    prevWantedRef.current = wanted;

    // New show cycle
    if (!prev && wanted) {
      beginShow();
      return;
    }

    // End cycle (normal hide)
    if (prev && !wanted) {
      beginHide();
    }
  }, [wanted]);

  // Cleanup timers on unmount
  useEffect(() => clearTimers, []);

  if (!isMounted) return null;

  return (
    <div className="app-loader-overlay" data-state={isOpen ? "open" : "closed"} role="status" aria-label="Loading">
      <div className="app-loader" aria-hidden="true">
        <div className="circle" />
        <div className="circle" />
        <div className="circle" />
        <div className="shadow" />
        <div className="shadow" />
        <div className="shadow" />
      </div>
    </div>
  );
}
