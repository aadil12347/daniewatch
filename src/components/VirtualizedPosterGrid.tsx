import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Grid } from "react-window";
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
};

function useElementWidth(ref: React.RefObject<HTMLElement>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.floor(w));
    });
    ro.observe(el);

    // Initial
    setWidth(Math.floor(el.getBoundingClientRect().width));

    return () => ro.disconnect();
  }, [ref]);

  return width;
}

export function VirtualizedPosterGrid({ items, isLoading, skeletonCount = 18, className, onEndReached }: Props) {
  const location = useLocation();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const width = useElementWidth(viewportRef);

  const [height, setHeight] = useState(600);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 600;
      setHeight(Math.max(300, Math.floor(h)));
    });
    ro.observe(el);
    setHeight(Math.max(300, Math.floor(el.getBoundingClientRect().height || 600)));
    return () => ro.disconnect();
  }, []);

  // Container-scroll persistence (per route).
  useContainerScrollCache(scrollerRef.current, `dw_scroll_${location.pathname}${location.search}`);

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

  // Never show a blank viewport (helps during the initial layout/caching races).
  if (isLoading || items.length === 0) {
    return (
      <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6", className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[2/3] rounded-xl animate-none" />
            <Skeleton className="h-4 w-3/4 mt-3 animate-none" />
            <Skeleton className="h-3 w-1/2 mt-2 animate-none" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={viewportRef} className={cn("w-full h-full", className)}>
      <div ref={scrollerRef} className="h-full w-full overflow-auto">
        {width > 0 ? (
          <Grid
            columnCount={columnCount}
            columnWidth={columnWidth}
            defaultHeight={height}
            defaultWidth={width}
            rowCount={rowCount}
            rowHeight={rowHeight}
            overscanCount={3}
            cellProps={{}}
            style={{ height: "100%", width: "100%" }}
            onCellsRendered={({ rowStopIndex }) => {
              // Trigger a fetch when user is near the end.
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
        ) : null}
      </div>
    </div>
  );
}
