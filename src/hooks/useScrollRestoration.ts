import { useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const SCROLL_KEY_PREFIX = "scroll_";
const TRANSITION_DELAY = 350; // Wait for page transition to complete

export const useScrollRestoration = (isDataLoaded: boolean) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const storageKey = `${SCROLL_KEY_PREFIX}${location.pathname}`;
  const hasRestoredRef = useRef(false);

  // Save scroll position
  const saveScrollPosition = useCallback(() => {
    sessionStorage.setItem(storageKey, window.scrollY.toString());
  }, [storageKey]);

  // Reset restoration flag on location change
  useEffect(() => {
    hasRestoredRef.current = false;
  }, [location.pathname]);

  // Restore scroll position when data is loaded (only on back/forward navigation)
  useEffect(() => {
    // Only restore on POP (back/forward) navigation
    if (!isDataLoaded || navigationType !== "POP") {
      return;
    }
    
    // Prevent double restoration
    if (hasRestoredRef.current) return;
    
    const savedPosition = sessionStorage.getItem(storageKey);
    if (!savedPosition) return;
    
    const targetPosition = parseInt(savedPosition, 10);
    hasRestoredRef.current = true;
    
    // Wait for page transition animation to complete
    const restoreScroll = () => {
      // Double rAF for reliable timing after paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetPosition, behavior: "instant" as ScrollBehavior });
          
          // Retry if scroll didn't work (content might still be rendering)
          setTimeout(() => {
            if (Math.abs(window.scrollY - targetPosition) > 100) {
              window.scrollTo({ top: targetPosition, behavior: "instant" as ScrollBehavior });
            }
          }, 100);
        });
      });
    };
    
    // Wait for page transition animation to finish
    setTimeout(restoreScroll, TRANSITION_DELAY);
    
  }, [isDataLoaded, storageKey, navigationType]);

  // Save position before unmount
  useEffect(() => {
    return () => {
      saveScrollPosition();
    };
  }, [saveScrollPosition]);

  // Save on scroll (throttled) for more reliable position saving
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(saveScrollPosition, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [saveScrollPosition]);

  return { saveScrollPosition };
};
