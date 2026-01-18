import { useEffect, useRef } from "react";

const isFinePointer = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: fine)")?.matches;

export function MorphCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isFinePointer()) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    let raf = 0;
    let lastEvent: MouseEvent | null = null;

    const updateProperties = (state: {
      x: number;
      y: number;
      width: number;
      height: number;
      radius: string;
      scale: number;
    }) => {
      cursor.style.setProperty("--x", `${state.x}px`);
      cursor.style.setProperty("--y", `${state.y}px`);
      cursor.style.setProperty("--width", `${state.width}px`);
      cursor.style.setProperty("--height", `${state.height}px`);
      cursor.style.setProperty("--radius", state.radius);
      cursor.style.setProperty("--scale", `${state.scale}`);
    };

    const createState = (e: MouseEvent) => {
      const hoveredPoster = (e.target as Element | null)?.closest?.(
        ".poster-3d-card"
      ) as HTMLElement | null;

      // When not on a poster, hide the glow completely.
      const defaultState = {
        x: e.clientX,
        y: e.clientY,
        width: 48,
        height: 48,
        radius: "999px",
        scale: 0,
      };

      if (!hoveredPoster) return defaultState;

      const rect = hoveredPoster.getBoundingClientRect();
      const radius =
        window.getComputedStyle(hoveredPoster).borderTopLeftRadius || "999px";

      return {
        ...defaultState,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
        radius,
        scale: 1,
      };
    };

    const onMove = (e: MouseEvent) => {
      lastEvent = e;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!lastEvent) return;
        updateProperties(createState(lastEvent));
      });
    };

    document.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
    };
  }, []);

  return <div className="cursor" ref={cursorRef} aria-hidden="true" />;
}
