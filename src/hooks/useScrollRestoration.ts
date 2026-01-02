import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_KEY_PREFIX = "scroll_";

export const useScrollRestoration = (isDataLoaded: boolean) => {
  const location = useLocation();
  const storageKey = `${SCROLL_KEY_PREFIX}${location.pathname}`;
  const lastPathRef = useRef(location.pathname);
  const restorationAttemptedRef = useRef(false);

  // Save scroll position immediately
  const saveScrollPosition = useCallback(() => {
    const currentScroll = window.scrollY;
    if (currentScroll > 0) {
      sessionStorage.setItem(storageKey, currentScroll.toString());
    }
  }, [storageKey]);

  // Reset restoration flag when path actually changes
  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname;
      restorationAttemptedRef.current = false;
    }
  }, [location.pathname]);

  // Restore scroll position with retry logic when data is loaded
  useEffect(() => {
    if (!isDataLoaded || restorationAttemptedRef.current) {
      return;
    }

    const savedPosition = sessionStorage.getItem(storageKey);
    if (!savedPosition) {
      return;
    }

    const targetPosition = parseInt(savedPosition, 10);
    if (targetPosition <= 0 || isNaN(targetPosition)) {
      return;
    }

    restorationAttemptedRef.current = true;

    // Restoration with multiple attempts and longer delays
    const attemptRestore = (attempt: number) => {
      window.scrollTo({ top: targetPosition, behavior: "instant" });

      // Check if we're close enough to target
      const diff = Math.abs(window.scrollY - targetPosition);
      if (diff < 100) {
        return; // Success
      }

      // More attempts with increasing delays
      if (attempt < 5) {
        const delay = attempt * 100; // 100, 200, 300, 400ms
        setTimeout(() => attemptRestore(attempt + 1), delay);
      }
    };

    // Start restoration after a brief delay to allow DOM to settle
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          attemptRestore(1);
        });
      });
    }, 50);

    return () => clearTimeout(timeoutId);
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
