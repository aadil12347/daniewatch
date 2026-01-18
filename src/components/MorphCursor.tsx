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
      const target = e.target as Element | null;
      const ignore =
        !target ||
        target === document.documentElement ||
        target === document.body ||
        target.closest?.(".cursor");

      // Default: glow follows the pointer (so it works everywhere)
      const defaultState = {
        x: e.clientX,
        y: e.clientY,
        width: 42,
        height: 42,
        radius: "999px",
        scale: 1,
      };

      if (ignore) return defaultState;

      // When hovering any element (logos, text, filters, etc.), morph to it.
      const rect = (target as HTMLElement).getBoundingClientRect?.();
      if (!rect || rect.width < 2 || rect.height < 2) return defaultState;

      const radius =
        window.getComputedStyle(target).borderTopLeftRadius || "999px";

      return {
        ...defaultState,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
        radius,
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
