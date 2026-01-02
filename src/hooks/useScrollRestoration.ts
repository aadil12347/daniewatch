import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_KEY_PREFIX = "scroll_";

export const useScrollRestoration = (isDataLoaded: boolean) => {
  const location = useLocation();
  const storageKey = `${SCROLL_KEY_PREFIX}${location.pathname}`;
  const hasRestoredRef = useRef(false);

  // Save scroll position immediately
  const saveScrollPosition = useCallback(() => {
    const currentScroll = window.scrollY;
    if (currentScroll > 0) {
      sessionStorage.setItem(storageKey, currentScroll.toString());
    }
  }, [storageKey]);

  // Restore scroll position with retry logic when data is loaded
  useEffect(() => {
    if (isDataLoaded && !hasRestoredRef.current) {
      const savedPosition = sessionStorage.getItem(storageKey);
      if (savedPosition) {
        const targetPosition = parseInt(savedPosition, 10);
        if (targetPosition > 0) {
          hasRestoredRef.current = true;
          
          // Multiple restoration attempts to handle async rendering
          const attemptRestore = (attempt: number) => {
            window.scrollTo(0, targetPosition);
            
            // Verify if we reached the target
            if (Math.abs(window.scrollY - targetPosition) < 50) {
              return; // Success
            }
            
            // Schedule next attempt if not reached
            if (attempt < 3) {
              setTimeout(() => attemptRestore(attempt + 1), 150);
            }
          };
          
          // First attempt after DOM paint
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              attemptRestore(1);
            });
          });
        }
      }
    }
  }, [isDataLoaded, storageKey]);

  // Reset restoration flag when navigating to a new page
  useEffect(() => {
    hasRestoredRef.current = false;
  }, [location.pathname]);

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
