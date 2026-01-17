import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Global loader overlay shown during route changes + while network requests are in flight.
 * This is intentionally generic and does not require wiring per-page loading state.
 */
export function GlobalRouteLoader() {
  const location = useLocation();

  const [inflight, setInflight] = useState(0);
  const [routePending, setRoutePending] = useState(false);
  const [docPending, setDocPending] = useState(() => document.readyState !== "complete");

  const currentRouteKey = useMemo(() => location.pathname + location.search, [location.pathname, location.search]);
  const lastRouteKeyRef = useRef(currentRouteKey);

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
    }
  }, [currentRouteKey]);

  // Clear pending state once there are no requests left.
  useEffect(() => {
    if (!routePending) return;
    if (inflight > 0) return;

    // Let the new page paint first, then hide.
    const raf = requestAnimationFrame(() => setRoutePending(false));
    return () => cancelAnimationFrame(raf);
  }, [inflight, routePending]);

  const show = docPending || routePending || inflight > 0;
  if (!show) return null;

  return (
    <div className="app-loader-overlay" role="status" aria-label="Loading">
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
