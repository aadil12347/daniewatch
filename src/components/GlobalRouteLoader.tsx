import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, type Location } from "react-router-dom";

/**
 * Global loader overlay shown during route changes + while network requests are in flight.
 *
 * UX rules:
 * - minimum visible time: 1.5s (prevents flicker/glitch)
 * - maximum visible time: 10s (never blocks UI forever)
 * - fade in/out transition
 *
 * Extra rules:
 * - hides as soon as the next page reports "content ready" (so we don't wait for every request)
 * - disables scrolling while the overlay is visible
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

  const backgroundLocation = (location.state as any)?.backgroundLocation as Location | undefined;

  const currentRouteKey = useMemo(() => {
    const l = backgroundLocation ?? location;
    return l.pathname + l.search;
  }, [backgroundLocation, location.pathname, location.search]);
  const lastRouteKeyRef = useRef(currentRouteKey);

  const prevWantedRef = useRef(false);
  const cycleIdRef = useRef(0);
  const shownAtRef = useRef(0);
  const contentReadyRef = useRef(false);

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

  // Pages can tell us "first content rendered" so we can stop the fullscreen loader earlier.
  useEffect(() => {
    const onContentReady = () => {
      contentReadyRef.current = true;
      if (!routePending) return;
      const raf = requestAnimationFrame(() => setRoutePending(false));
      return () => cancelAnimationFrame(raf);
    };

    window.addEventListener("route:content-ready", onContentReady as EventListener);
    return () => window.removeEventListener("route:content-ready", onContentReady as EventListener);
  }, [routePending]);

  // Mark navigation as pending immediately when route changes.
  useEffect(() => {
    if (lastRouteKeyRef.current !== currentRouteKey) {
      lastRouteKeyRef.current = currentRouteKey;
      contentReadyRef.current = false;
      setRoutePending(true);
      // New route = new loader cycle, so allow showing again even if the previous one timed out.
      setTimedOut(false);
    }
  }, [currentRouteKey]);

  // If everything is settled, clear timeout suppression so the next load can show normally.
  // IMPORTANT: we only *show* the global overlay for initial doc load + route navigations.
  // Background fetches (e.g., infinite scroll) should use inline loaders, not a fullscreen overlay.
  const rawWanted = docPending || routePending;
  useEffect(() => {
    if (!rawWanted && timedOut) setTimedOut(false);
  }, [rawWanted, timedOut]);

  // IMPORTANT: we no longer auto-hide just because network is idle.
  // Pages must explicitly report "content ready" (after their first meaningful render),
  // otherwise the loader stays up until the hard timeout.
  // This prevents the overlay from disappearing before the initial grid batch is actually visible.


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

  // Disable scroll while fullscreen loader is visible.
  useEffect(() => {
    if (!isMounted || !isOpen) return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const prevent = (e: Event) => e.preventDefault();

    window.addEventListener("wheel", prevent, { passive: false });
    window.addEventListener("touchmove", prevent, { passive: false });

    return () => {
      window.removeEventListener("wheel", prevent);
      window.removeEventListener("touchmove", prevent);
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [isMounted, isOpen]);

  // Cleanup timers on unmount
  useEffect(() => clearTimers, []);

  if (!isMounted) return null;

  return (
    <div
      className="app-loader-overlay"
      data-state={isOpen ? "open" : "closed"}
      role="status"
      aria-label="Loading"
    >
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

