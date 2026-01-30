import { useRef, useState, useEffect } from "react";
import type { Movie } from "@/lib/tmdb";
import { ContentRow } from "./ContentRow";
import { usePerformanceMode } from "@/contexts/PerformanceModeContext";

interface DbContentRowProps {
  title: string;
  items: Movie[];
  sectionId?: string;
}

/**
 * Lazy-loaded wrapper for ContentRow that only renders when near the viewport.
 * Uses IntersectionObserver for performance optimization.
 */
export const DbContentRow = ({ title, items, sectionId }: DbContentRowProps) => {
  const { isPerformance } = usePerformanceMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If browser doesn't support IO, just show immediately
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Once visible, stay visible
        }
      },
      { rootMargin: "300px", threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Don't render if no items
  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className="min-h-[200px]">
      {isVisible ? (
        <ContentRow
          title={title}
          items={items}
          isLoading={false}
          hoverCharacterMode="contained"
          enableHoverPortal={false}
          disableHoverCharacter={isPerformance}
          disableHoverLogo={isPerformance}
          sectionId={sectionId}
        />
      ) : (
        // Placeholder to maintain scroll height estimation
        <div className="py-6">
          <div className="container mx-auto px-4 mb-4">
            <div className="h-7 w-32 bg-muted/20 rounded animate-pulse" />
          </div>
          <div className="flex gap-4 px-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-40 sm:w-48 aspect-[2/3] bg-muted/10 rounded-xl"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
