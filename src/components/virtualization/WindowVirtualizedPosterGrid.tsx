import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

type Props<T> = {
  items: T[];
  /** Called when we are near the end of the rendered list (window-scroll). */
  onEndReached?: () => void;
  /** Called with the current top visible index (used by RAM guard). */
  onTopIndexChange?: (index: number) => void;
  /** Render a single tile. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Skeleton grid shown while loading. */
  renderSkeleton?: () => React.ReactNode;
  /** Tailwind gap size (defaults to 1rem). */
  gapPx?: number;
};

const DEFAULT_GAP = 16;

function computeColumns(width: number) {
  // Mirrors: grid-cols-2 sm:3 md:4 lg:5 xl:6
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

export function WindowVirtualizedPosterGrid<T>({
  items,
  onEndReached,
  onTopIndexChange,
  renderItem,
  renderSkeleton,
  gapPx = DEFAULT_GAP,
}: Props<T>) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostWidth, setHostWidth] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setHostWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => computeColumns(hostWidth), [hostWidth]);
  const rows = useMemo(() => Math.ceil(items.length / Math.max(columns, 1)), [columns, items.length]);

  const columnWidth = useMemo(() => {
    if (!hostWidth || !columns) return 0;
    return Math.max(0, (hostWidth - gapPx * (columns - 1)) / columns);
  }, [columns, gapPx, hostWidth]);

  const rowHeight = useMemo(() => {
    // Poster (2/3) + title/meta area. Matches existing grid roughly.
    const poster = columnWidth ? columnWidth * 1.5 : 300;
    return Math.ceil(poster + 64);
  }, [columnWidth]);

  // TanStack Virtual's types vary slightly across versions; we always window-scroll here.
  const rowVirtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => rowHeight + gapPx,
    overscan: 6,
  } as any);

  useEffect(() => {
    const v = rowVirtualizer.getVirtualItems();
    const first = v[0]?.index ?? 0;
    onTopIndexChange?.(first * columns);

    const last = v[v.length - 1]?.index ?? 0;
    const lastItemIndex = (last + 1) * columns - 1;
    if (onEndReached && items.length > 0 && lastItemIndex >= items.length - columns * 2) {
      onEndReached();
    }
  }, [columns, items.length, onEndReached, onTopIndexChange, rowVirtualizer]);

  if (renderSkeleton) {
    return <div ref={hostRef}>{renderSkeleton()}</div>;
  }

  return (
    <div ref={hostRef}>
      <div
        style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
        className="w-full"
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const endIndex = Math.min(startIndex + columns, items.length);
          const rowItems = items.slice(startIndex, endIndex);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="grid"
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gap: `${gapPx}px`,
                }}
              >
                {rowItems.map((item, col) => renderItem(item, startIndex + col))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
