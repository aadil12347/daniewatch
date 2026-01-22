import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Grid, useGridRef } from "react-window";
import { Skeleton } from "@/components/ui/skeleton";
import { MovieCard } from "@/components/MovieCard";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { useContainerScrollCache } from "@/hooks/useContainerScrollCache";

import type { Movie } from "@/lib/tmdb";

type Props = {
  items: Movie[];
  isLoading: boolean;
  skeletonCount?: number;
  className?: string;
  onEndReached?: () => void;
  /**
   * container: react-window scroll container (shows inner scrollbar)
   * window: page scroll drives grid (no inner scrollbar)
   */
  scrollMode?: "container" | "window";
};

function useElementWidth(el: HTMLElement | null) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.floor(w));
    });
    ro.observe(el);

    // Initial
    setWidth(Math.floor(el.getBoundingClientRect().width));

    return () => ro.disconnect();
  }, [el]);

  return width;
}

export function VirtualizedPosterGrid({
  items,
  isLoading,
  skeletonCount = 18,
  className,
  onEndReached,
  scrollMode = "container",
}: Props) {
  const location = useLocation();
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  const width = useElementWidth(viewportEl);

  const gridRef = useGridRef();

  const [height, setHeight] = useState(600);
  useEffect(() => {
    if (!viewportEl) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 600;
      setHeight(Math.max(300, Math.floor(h)));
    });
    ro.observe(viewportEl);
    setHeight(Math.max(300, Math.floor(viewportEl.getBoundingClientRect().height || 600)));
    return () => ro.disconnect();
  }, [viewportEl]);

  // Container-scroll persistence (per route). Grid owns the scroll container in react-window@2.
  // In window-scroll mode, the page scroll is the source of truth.
  useContainerScrollCache(
    scrollMode === "container" ? gridRef.current?.element : null,
    `dw_scroll_${location.pathname}${location.search}`
  );

  const { columnCount, columnWidth, rowHeight } = useMemo(() => {
    // Match your existing breakpoints (2..6 columns)
    const cols = width >= 1280 ? 6 : width >= 1024 ? 5 : width >= 768 ? 4 : width >= 640 ? 3 : 2;
    const gap = width >= 768 ? 24 : 16;

    const totalGap = gap * (cols - 1);
    const colW = Math.max(140, Math.floor((width - totalGap) / cols));
    const posterH = Math.floor(colW * 1.5); // 2/3 aspect
    const textH = 58;
    const rH = posterH + textH + gap;

    return { columnCount: cols, columnWidth: colW + gap, rowHeight: rH };
  }, [width]);

  const renderItems = isLoading ? [] : items;
  const rowCount = Math.max(1, Math.ceil(renderItems.length / columnCount));

  // End reached trigger (near bottom).
  const endReachedRef = useRef(false);
  useEffect(() => {
    endReachedRef.current = false;
  }, [items.length, isLoading]);

  // Always render the measuring container so width/height can resolve (prevents blank pages).
  const showSkeletons = isLoading || items.length === 0 || width === 0;

  // --- Window scroll mode (no inner scrollbar) ---
  const windowContainerRef = useRef<HTMLDivElement | null>(null);
  const [windowViewportHeight, setWindowViewportHeight] = useState(() => Math.max(320, window.innerHeight));

  useEffect(() => {
    if (scrollMode !== "window") return;
    const onResize = () => setWindowViewportHeight(Math.max(320, window.innerHeight));
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [scrollMode]);

  useEffect(() => {
    if (scrollMode !== "window") return;
    if (!windowContainerRef.current) return;

    let raf = 0;

    const sync = () => {
      raf = 0;
      const el = windowContainerRef.current;
      const gridEl = gridRef.current?.element;
      if (!el || !gridEl) return;

      const top = el.getBoundingClientRect().top + window.scrollY;
      const maxScrollTop = Math.max(0, rowCount * rowHeight - windowViewportHeight);
      const nextScrollTop = Math.min(Math.max(0, window.scrollY - top), maxScrollTop);
      gridEl.scrollTop = nextScrollTop;
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(sync);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Initial sync
    sync();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rowCount, rowHeight, scrollMode, windowViewportHeight]);

  return (
    <div
      ref={scrollMode === "window" ? windowContainerRef : setViewportEl}
      className={cn("w-full min-h-[360px] overflow-x-hidden", scrollMode === "window" ? "relative" : "h-full", className)}
      style={scrollMode === "window" ? { height: rowCount * rowHeight } : undefined}
    >
      {showSkeletons ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[2/3] rounded-xl animate-none" />
              <Skeleton className="h-4 w-3/4 mt-3 animate-none" />
              <Skeleton className="h-3 w-1/2 mt-2 animate-none" />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={setViewportEl}
          className={cn(scrollMode === "window" ? "sticky top-0" : "")}
          style={scrollMode === "window" ? { height: windowViewportHeight } : undefined}
        >
          <Grid
            gridRef={gridRef}
            columnCount={columnCount}
            columnWidth={columnWidth}
            rowCount={rowCount}
            rowHeight={rowHeight}
            overscanCount={3}
            cellProps={{}}
            // Prevent rare 1-2px width overshoots from creating a horizontal scrollbar.
            style={{ height: scrollMode === "window" ? windowViewportHeight : height, width, overflowX: "hidden", overflowY: scrollMode === "window" ? "hidden" : undefined }}
            onCellsRendered={({ rowStopIndex }) => {
              const remainingRows = rowCount - 1 - rowStopIndex;
              if (remainingRows > 3) return;
              if (endReachedRef.current) return;
              endReachedRef.current = true;
              onEndReached?.();
            }}
            cellComponent={({ columnIndex, rowIndex, style }) => {
              const index = rowIndex * columnCount + columnIndex;
              const movie = renderItems[index];
              if (!movie) return null;
              return (
                <div style={style} className="p-2 md:p-3">
                  <MovieCard movie={movie} enableReveal={false} enableHoverPortal={false} />
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
