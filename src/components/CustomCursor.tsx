import { useEffect, useRef } from "react";

type Point = { x: number; y: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * CustomCursor
 * - Follows the pointer with a smooth lerp
 * - On elements marked with [data-hover], becomes "magnetic" and subtly stretches/rotates
 * - Disabled automatically on coarse pointers (touch)
 */
export const CustomCursor = () => {
  const elRef = useRef<HTMLDivElement | null>(null);

  const pointer = useRef<Point>({ x: -200, y: -200 });
  const pos = useRef<Point>({ x: -200, y: -200 });
  const prev = useRef<Point>({ x: -200, y: -200 });

  const hoveredEl = useRef<HTMLElement | null>(null);
  const isHovered = useRef(false);

  useEffect(() => {
    // Skip on touch / coarse pointers.
    if (typeof window === "undefined") return;
    const canUseFinePointer = window.matchMedia?.("(pointer: fine)")?.matches;
    if (!canUseFinePointer) return;

    const el = elRef.current;
    if (!el) return;

    let raf = 0;

    const onPointerMove = (e: PointerEvent) => {
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
    };

    const onPointerOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const hoverTarget = target?.closest?.("[data-hover]") as HTMLElement | null;
      if (!hoverTarget) return;

      isHovered.current = true;
      hoveredEl.current = hoverTarget;
    };

    const onPointerOut = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const hoverTarget = target?.closest?.("[data-hover]") as HTMLElement | null;
      if (!hoverTarget) return;

      // If we're leaving the current hovered element, reset.
      if (hoveredEl.current === hoverTarget) {
        isHovered.current = false;
        hoveredEl.current = null;
      }
    };

    const tick = () => {
      const p = pointer.current;

      // Base target is the pointer.
      let tx = p.x;
      let ty = p.y;
      let targetScale = 1;

      // Magnetic/hover state.
      if (isHovered.current && hoveredEl.current) {
        const bounds = hoveredEl.current.getBoundingClientRect();
        const cx = bounds.left + bounds.width / 2;
        const cy = bounds.top + bounds.height / 2;
        const dx = p.x - cx;
        const dy = p.y - cy;

        // Pull cursor slightly toward center when hovering.
        tx = cx + dx * 0.15;
        ty = cy + dy * 0.15;
        targetScale = 1.8;

        // Rotate toward direction.
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        el.style.setProperty("--cursor-rotate", `${angle}deg`);
      } else {
        el.style.setProperty("--cursor-rotate", `0deg`);
      }

      // Smooth follow.
      pos.current.x = lerp(pos.current.x, tx, 0.12);
      pos.current.y = lerp(pos.current.y, ty, 0.12);

      // Compute velocity for squash/stretch.
      const vx = pos.current.x - prev.current.x;
      const vy = pos.current.y - prev.current.y;
      prev.current.x = pos.current.x;
      prev.current.y = pos.current.y;

      const speed = Math.min(Math.hypot(vx, vy) * 0.04, 1);

      const scaleX = targetScale + (isHovered.current ? Math.pow(speed, 2) * 1.2 : speed);
      const scaleY = targetScale - (isHovered.current ? Math.pow(Math.min(speed, 0.6), 2) * 0.8 : Math.min(speed, 0.35));

      el.style.setProperty("--cursor-x", `${pos.current.x}px`);
      el.style.setProperty("--cursor-y", `${pos.current.y}px`);
      el.style.setProperty("--cursor-scale-x", `${scaleX}`);
      el.style.setProperty("--cursor-scale-y", `${scaleY}`);

      raf = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });

    raf = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return <div aria-hidden="true" className="app-cursor" ref={elRef} />;
};
