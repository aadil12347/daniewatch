import React, { useEffect, useMemo, useRef, useState } from "react";

type RenderItem<T> = (item: T | null, index: number) => React.ReactNode;

type Props<T> = {
  /** Loaded+revealed items (indexes < items.length are real, beyond are placeholders). */
  items: T[];
  /** Total item count to represent in the scrollbar (hybrid DB + TMDB estimate). */
  totalItemCount: number;
  /** Extra future scroll buffer at the end (in px). Default: 1000. */
  futureBufferPx?: number;
  /** Called when we are approaching the end of the loaded segment. */
  onNeedMoreData?: () => void;
  /** Called with the current top visible item index (optional RAM guard integration). */
  onTopIndexChange?: (index: number) => void;
  /** Render a single tile (or skeleton placeholder when item is null). */
  renderItem: RenderItem<T>;
  /** Tailwind gap size (defaults to 1rem). */
  gapPx?: number;
  /** Number of rows to keep mounted (not counting overscan). */
  windowRows?: number;
  /** Extra rows above/below to reduce observer churn. */
  overscanRows?: number;
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

/**
 * Window-scroll, row-recycling grid using dual IntersectionObserver sentinels.
 * Keeps DOM small by mounting only a small window of rows and simulating the rest with spacer divs.
 */
export function BiDirectionalRecyclingPosterGrid<T>({
  items,
  totalItemCount,
  futureBufferPx = 1000,
  onNeedMoreData,
  onTopIndexChange,
  renderItem,
  gapPx = DEFAULT_GAP,
  windowRows = 12,
  overscanRows = 3,
}: Props<T>) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostWidth, setHostWidth] = useState(0);

  // Top-Zero Force: when near the very top, force padding-top=0 and render from row 0.
  const [topLock, setTopLock] = useState(false);
  const topLockRef = useRef(false);

  const topRowRef = useRef<HTMLDivElement | null>(null);
  const bottomRowRef = useRef<HTMLDivElement | null>(null);
  const bottomSpacerRef = useRef<HTMLDivElement | null>(null);

  const topObserverRef = useRef<IntersectionObserver | null>(null);
  const bottomObserverRef = useRef<IntersectionObserver | null>(null);
  const bottomSpacerObserverRef = useRef<IntersectionObserver | null>(null);

  const [rowStart, setRowStart] = useState(0);
  const rowStartRef = useRef(0);
  const lastScrollYRef = useRef<number>(0);
  const lastScrollYPrevRef = useRef<number>(0);

  // Track the maximum number of loaded rows we've ever had, so scroll height only
  // increases when a successful fetch/appended chunk arrives (prevents shrink/jump).
  const maxLoadedRowsRef = useRef(0);
  const prevItemsLenRef = useRef(0);

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

  const columnWidth = useMemo(() => {
    if (!hostWidth || !columns) return 0;
    return Math.max(0, (hostWidth - gapPx * (columns - 1)) / columns);
  }, [columns, gapPx, hostWidth]);

  const rowHeight = useMemo(() => {
    // Poster (2/3) + title/meta area. Matches other grids.
    const poster = columnWidth ? columnWidth * 1.5 : 300;
    return Math.ceil(poster + 64);
  }, [columnWidth]);

  // Rows represented by the loaded data (NOT the API-estimated total).
  const loadedRows = useMemo(() => {
    return Math.ceil(items.length / Math.max(columns, 1));
  }, [columns, items.length]);

  // Defensive: if we have a non-zero totalItemCount but zero loaded items,
  // still render a small placeholder window so the page is never fully blank.
  const renderRowsCap = useMemo(() => {
    const totalRows = Math.ceil(totalItemCount / Math.max(columns, 1));
    if (totalItemCount <= 0 || totalRows <= 0) return 0;
    return Math.min(totalRows, windowRows);
  }, [columns, totalItemCount, windowRows]);

  const maxRowsForRender = useMemo(() => {
    if (renderRowsCap <= 0) return maxLoadedRowsRef.current;
    return Math.max(maxLoadedRowsRef.current, renderRowsCap);
  }, [renderRowsCap]);

  // Prevent state updates that would cause the grid to render zero rows.
  const safeSetRowStart = useMemo(() => {
    return (updater: (prev: number) => number) => {
      setRowStart((prev) => {
        const maxRows = maxRowsForRender;
        if (maxRows <= 0) return prev;

        const proposed = updater(prev);
        const clamped = Math.min(Math.max(0, proposed), Math.max(0, maxRows - windowRows));

        const rowEndCandidate = Math.min(maxRows - 1, clamped + windowRows - 1);
        if (rowEndCandidate < clamped) return prev;

        return clamped;
      });
    };
  }, [maxRowsForRender, windowRows]);

  useEffect(() => {
    // Reset monotonic tracker when the list is cleared/reset (e.g., filter changes).
    if (items.length < prevItemsLenRef.current) {
      maxLoadedRowsRef.current = loadedRows;
    } else {
      maxLoadedRowsRef.current = Math.max(maxLoadedRowsRef.current, loadedRows);
    }
    prevItemsLenRef.current = items.length;
  }, [items.length, loadedRows]);

  // Clamp rowStart when columns/loaded rows change.
  useEffect(() => {
    setRowStart((prev) => {
      const maxStart = Math.max(0, maxLoadedRowsRef.current - windowRows);
      return Math.min(Math.max(0, prev), maxStart);
    });
  }, [columns, items.length, windowRows]);

  const rowEnd = useMemo(() => {
    const maxRows = maxRowsForRender;
    if (maxRows <= 0) return 0;
    return Math.min(maxRows - 1, rowStart + windowRows - 1);
  }, [maxRowsForRender, rowStart, windowRows]);

  const rowStridePx = rowHeight + gapPx;
  const topSpacerPx = rowStart * rowStridePx;
  const effectiveTopSpacerPx = topLock ? 0 : topSpacerPx;

  const effectiveFutureBufferPx = items.length >= totalItemCount ? 0 : Math.max(0, futureBufferPx);
  // Bottom padding represents only already-loaded rows that are currently not mounted,
  // plus a small fixed future buffer to allow smooth approach to the end.
  const bottomSpacerPx =
    Math.max(0, (maxLoadedRowsRef.current - (rowEnd + 1)) * rowStridePx) + effectiveFutureBufferPx;

  const needsMoreThresholdIndex = useMemo(() => {
    // Similar to WindowVirtualizedPosterGrid: request more when within ~2 rows of end.
    return Math.max(0, items.length - columns * 2);
  }, [columns, items.length]);

  // Track scroll direction (used to make "scroll up" recycling less jittery).
  useEffect(() => {
    const onScroll = () => {
      lastScrollYPrevRef.current = lastScrollYRef.current;
      lastScrollYRef.current = window.scrollY;

      // Top-Zero Force: if we're near the top, wipe virtualization offsets immediately.
      // This prevents "black screen" gaps during fast upward scrolling.
      const shouldLock = window.scrollY < 100;
      if (shouldLock !== topLockRef.current) {
        topLockRef.current = shouldLock;
        setTopLock(shouldLock);
      }
      if (shouldLock && rowStartRef.current !== 0) {
        setRowStart(0);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    rowStartRef.current = rowStart;
    onTopIndexChange?.(rowStart * columns);
  }, [columns, onTopIndexChange, rowStart]);

  useEffect(() => {
    topObserverRef.current?.disconnect();
    bottomObserverRef.current?.disconnect();

    const topEl = topRowRef.current;
    const bottomEl = bottomRowRef.current;
    if (!topEl || !bottomEl) return;

    topObserverRef.current = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;

        // If the top row has fully left the viewport upwards while scrolling down, recycle forward.
        if (!e.isIntersecting && e.boundingClientRect.top < 0) {
          safeSetRowStart((prev) => {
            const maxStart = Math.max(0, maxLoadedRowsRef.current - windowRows);
            if (prev >= maxStart) return prev;
            return prev + 1;
          });
        }

        // If scrolling up and the top row is strongly visible, recycle backward (prepend).
        // We gate this to avoid oscillation near the boundary.
        if (e.isIntersecting && e.intersectionRatio > 0.85) {
          const scrollingUp = lastScrollYRef.current < lastScrollYPrevRef.current;
          if (!scrollingUp) return;
          safeSetRowStart((prev) => Math.max(0, prev - 1));
        }
      },
      { threshold: [0, 0.85] }
    );

    bottomObserverRef.current = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting) return;

        // If not yet at the end of loaded rows, keep recycling forward as the bottom becomes visible.
        // This keeps the mounted window centered around the viewport during fast scroll.
        // Cap Row Recycling: do not advance unless there are *loaded* rows beyond the current window.
        if (rowEnd < maxLoadedRowsRef.current - 1) {
          safeSetRowStart((prev) => {
            const maxStart = Math.max(0, maxLoadedRowsRef.current - windowRows);
            return Math.min(prev + 1, maxStart);
          });
        }
      },
      { rootMargin: "600px 0px 600px 0px", threshold: 0.01 }
    );

    topObserverRef.current.observe(topEl);
    bottomObserverRef.current.observe(bottomEl);

    return () => {
      topObserverRef.current?.disconnect();
      bottomObserverRef.current?.disconnect();
    };
    // NOTE: depend on the computed rowEnd/totalRows so the observers rebind to new sentinels.
  }, [columns, items.length, rowEnd, rowStart, safeSetRowStart, windowRows]);

  // Persistent Loading Sentinel: observe the bottom spacer so that as long as the user
  // has scrolled into the future buffer area, we keep attempting to fetch more.
  useEffect(() => {
    bottomSpacerObserverRef.current?.disconnect();
    const spacerEl = bottomSpacerRef.current;
    if (!spacerEl) return;

    let interval: number | null = null;
    const clear = () => {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    bottomSpacerObserverRef.current = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        if (!e.isIntersecting) {
          clear();
          return;
        }

        // Fire immediately and keep trying while the spacer remains visible.
        onNeedMoreData?.();
        if (interval === null) {
          interval = window.setInterval(() => {
            onNeedMoreData?.();
          }, 700);
        }
      },
      { rootMargin: "800px 0px 0px 0px", threshold: 0.01 }
    );

    bottomSpacerObserverRef.current.observe(spacerEl);
    return () => {
      clear();
      bottomSpacerObserverRef.current?.disconnect();
    };
  }, [onNeedMoreData, effectiveFutureBufferPx, totalItemCount, items.length]);

  // Render rows in the current window.
  const rowsToRender = useMemo(() => {
    const maxRows = maxRowsForRender;
    if (maxRows <= 0) return [] as number[];
    // Safety Buffer: always keep at least 2 rows above and below in the DOM.
    const safetyOverscan = Math.max(2, overscanRows);
    const start = Math.max(0, rowStart - safetyOverscan);
    const end = Math.min(maxRows - 1, rowEnd + safetyOverscan);
    const out: number[] = [];
    for (let r = start; r <= end; r += 1) out.push(r);
    return out;
  }, [maxRowsForRender, overscanRows, rowEnd, rowStart]);

  return (
    <div
      ref={hostRef}
      className="min-h-screen bg-background"
      style={{ overflowAnchor: "auto", minHeight: "100vh" }}
    >
      <div style={{ height: effectiveTopSpacerPx }} aria-hidden="true" />

      <div className="w-full">
        {rowsToRender.map((r, idx) => {
          const startIndex = r * columns;
          const endIndex = Math.min(startIndex + columns, totalItemCount);

          const isFirstRendered = idx === 0;
          const isLastRendered = idx === rowsToRender.length - 1;

          return (
            <div
              key={r}
              ref={isFirstRendered ? topRowRef : isLastRendered ? bottomRowRef : undefined}
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: `${gapPx}px`,
                height: `${rowHeight}px`,
                marginBottom: `${gapPx}px`,
              }}
            >
              {Array.from({ length: endIndex - startIndex }).map((_, col) => {
                const index = startIndex + col;
                const item = index < items.length ? items[index] : null;
                // Keep each cell height stable to avoid row height "guessing".
                return (
                  <div key={index} className="h-full">
                    {renderItem(item, index)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div ref={bottomSpacerRef} style={{ height: bottomSpacerPx }} aria-hidden="true" />
    </div>
  );
}
