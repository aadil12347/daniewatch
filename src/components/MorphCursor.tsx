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

    document.documentElement.classList.add("cursor-morph-enabled");

    let onElement: Element | undefined;
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
      const defaultState = {
        x: e.clientX,
        y: e.clientY,
        width: 42,
        height: 42,
        radius: "999px",
        scale: 1,
      };

      if (!onElement) return defaultState;

      const rect = (onElement as HTMLElement).getBoundingClientRect();
      const radius = window
        .getComputedStyle(onElement)
        .borderTopLeftRadius || "999px";

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

    const onEnterInteractive = (e: Event) => {
      onElement = e.currentTarget as Element;
      // Slightly stronger presence when locked on an element.
      cursor.style.setProperty("--scale", "1");
    };

    const onLeaveInteractive = () => {
      onElement = undefined;
    };

    const interactiveSelector = "a, button, [role='button'], input, select, textarea";
    const interactive = Array.from(
      document.querySelectorAll(interactiveSelector)
    );

    interactive.forEach((el) => {
      el.addEventListener("mouseenter", onEnterInteractive);
      el.addEventListener("mouseleave", onLeaveInteractive);
    });

    document.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      interactive.forEach((el) => {
        el.removeEventListener("mouseenter", onEnterInteractive);
        el.removeEventListener("mouseleave", onLeaveInteractive);
      });
      document.documentElement.classList.remove("cursor-morph-enabled");
    };
  }, []);

  return <div className="cursor" ref={cursorRef} aria-hidden="true" />;
}
