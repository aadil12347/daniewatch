import React from "react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, type Location } from "react-router-dom";

/**
 * Dispatches `route:content-ready` once per route navigation, when `ready` becomes true.
 *
 * This is used by GlobalRouteLoader to keep the fullscreen loading overlay visible
 * until the page has rendered its "first meaningful" content (e.g. first 24 cards).
 */
export function useRouteContentReady(ready: boolean) {
  const location = useLocation();

  const backgroundLocation = (location.state as any)?.backgroundLocation as Location | undefined;

  const routeKey = useMemo(() => {
    const l = backgroundLocation ?? location;
    return l.pathname + l.search;
  }, [backgroundLocation, location.pathname, location.search]);

  const lastRouteKeyRef = useRef(routeKey);
  const firedRef = useRef(false);

  // Reset "fired" when the route changes.
  useEffect(() => {
    if (lastRouteKeyRef.current !== routeKey) {
      lastRouteKeyRef.current = routeKey;
      firedRef.current = false;
    }
  }, [routeKey]);

  useEffect(() => {
    if (!ready) return;
    if (firedRef.current) return;

    firedRef.current = true;
    requestAnimationFrame(() => window.dispatchEvent(new Event("route:content-ready")));
  }, [ready, routeKey]);
}
