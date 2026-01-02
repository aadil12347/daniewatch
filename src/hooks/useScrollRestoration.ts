import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_KEY_PREFIX = "scroll_";

export const useScrollRestoration = (isDataLoaded: boolean) => {
  const location = useLocation();
  const storageKey = `${SCROLL_KEY_PREFIX}${location.pathname}`;
  const lastPathRef = useRef(location.pathname);
  const lastKeyRef = useRef(location.key);
  const restorationAttemptedRef = useRef(false);
  const lastKnownScrollYRef = useRef(window.scrollY);

  // Track scroll position continuously with passive listener
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          lastKnownScrollYRef.current = window.scrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Save scroll position using last known good value (not instantaneous)
  const saveScrollPosition = useCallback(() => {
    const currentScroll = lastKnownScrollYRef.current;
    const existingValue = sessionStorage.getItem(storageKey);
    const existingScroll = existingValue ? parseInt(existingValue, 10) : 0;

    // Safe save: don't overwrite a good position with near-zero
    if (currentScroll < 20 && existingScroll > 50) {
      // Keep existing - likely a transient 0 during transition
      return;
    }

    if (currentScroll > 0) {
      sessionStorage.setItem(storageKey, currentScroll.toString());
    }
  }, [storageKey]);

  // Reset restoration flag when path or key changes
  useEffect(() => {
    if (lastPathRef.current !== location.pathname || lastKeyRef.current !== location.key) {
      lastPathRef.current = location.pathname;
      lastKeyRef.current = location.key;
      restorationAttemptedRef.current = false;
    }
  }, [location.pathname, location.key]);

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
      if (diff < 50) {
        return; // Success
      }

      // More attempts with increasing delays (including late attempts for animations)
      const delays = [100, 200, 300, 400, 700];
      if (attempt < delays.length) {
        setTimeout(() => attemptRestore(attempt + 1), delays[attempt]);
      }
    };

    // Start restoration after a brief delay to allow DOM to settle
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          attemptRestore(0);
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
