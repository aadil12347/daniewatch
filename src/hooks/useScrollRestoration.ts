import { useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const SCROLL_KEY_PREFIX = "scroll_";
const TRANSITION_DELAY = 350; // Wait for page transition to complete

export const useScrollRestoration = (isDataLoaded: boolean) => {
  const location = useLocation();
  const navigationType = useNavigationType();

  // IMPORTANT: freeze the path/key for this hook instance.
  // During PageTransition, the previous page component can stay mounted briefly while the URL already changed.
  // If we recompute the key from location.pathname, we can overwrite the saved scroll with "0".
  const pathRef = useRef(location.pathname);
  const storageKey = `${SCROLL_KEY_PREFIX}${pathRef.current}`;

  const hasRestoredRef = useRef(false);

  // Save scroll position (only if we're still on the same path this hook was created for)
  const saveScrollPosition = useCallback(() => {
    if (window.location.pathname !== pathRef.current) return;
    sessionStorage.setItem(storageKey, window.scrollY.toString());
  }, [storageKey]);

  // Restore scroll position when data is loaded (only on back/forward navigation)
  useEffect(() => {
    if (!isDataLoaded || navigationType !== "POP") return;
    if (hasRestoredRef.current) return;

    const savedPosition = sessionStorage.getItem(storageKey);
    if (!savedPosition) return;

    const targetPosition = parseInt(savedPosition, 10);
    hasRestoredRef.current = true;

    const timer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Use classic scrollTo for maximum browser compatibility
          window.scrollTo(0, targetPosition);

          // Retry once if content height was still settling
          window.setTimeout(() => {
            if (Math.abs(window.scrollY - targetPosition) > 100) {
              window.scrollTo(0, targetPosition);
            }
          }, 100);
        });
      });
    }, TRANSITION_DELAY);

    return () => window.clearTimeout(timer);
  }, [isDataLoaded, storageKey, navigationType]);

  // Save position before unmount
  useEffect(() => {
    return () => {
      saveScrollPosition();
    };
  }, [saveScrollPosition]);

  // Save on scroll (throttled) for more reliable position saving
  useEffect(() => {
    let timeoutId: number | undefined;

    const handleScroll = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(saveScrollPosition, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [saveScrollPosition]);

  return { saveScrollPosition };
};
