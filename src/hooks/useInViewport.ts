import { useEffect, useState } from "react";

export type InViewportOptions = {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
};

/**
 * Lightweight IntersectionObserver hook to know when an element is near/inside the viewport.
 * Useful for preloading assets (e.g. hover logos) right before the user interacts.
 */
export const useInViewport = (
  ref: React.RefObject<Element>,
  { root = null, rootMargin = "240px", threshold = 0.01 }: InViewportOptions = {}
) => {
  const [inViewport, setInViewport] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If the browser doesn't support IO, just assume visible.
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setInViewport(true);
          observer.disconnect(); // one-way: once visible, keep true
        }
      },
      { root, rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, root, rootMargin, threshold]);

  return inViewport;
};
