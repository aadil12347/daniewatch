import { useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_KEY_PREFIX = "scroll_";

export const useScrollRestoration = (isDataLoaded: boolean) => {
  const location = useLocation();
  const storageKey = `${SCROLL_KEY_PREFIX}${location.pathname}`;

  // Save scroll position
  const saveScrollPosition = useCallback(() => {
    sessionStorage.setItem(storageKey, window.scrollY.toString());
  }, [storageKey]);

  // Restore scroll position when data is loaded
  useEffect(() => {
    if (isDataLoaded) {
      const savedPosition = sessionStorage.getItem(storageKey);
      if (savedPosition) {
        // Use requestAnimationFrame for smoother restoration
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(savedPosition, 10));
        });
      }
    }
  }, [isDataLoaded, storageKey]);

  // Save position before unmount
  useEffect(() => {
    return () => {
      saveScrollPosition();
    };
  }, [saveScrollPosition]);

  // Also save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveScrollPosition();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveScrollPosition]);

  return { saveScrollPosition };
};
