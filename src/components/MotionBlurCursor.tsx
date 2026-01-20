import React from "react";
import { useEffect, useMemo, useRef } from "react";

type Position = {
  distanceX: number;
  distanceY: number;
  pointerX: number;
  pointerY: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function MotionBlurCursor() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement | null>(null);

  const cursorSize = 25;
  const degrees = 57.296;

  const cursorStyle = useMemo<React.CSSProperties>(
    () => ({
      boxSizing: "border-box",
      position: "fixed",
      top: `${cursorSize / -2}px`,
      left: `${cursorSize / -2}px`,
      zIndex: 2147483647,
      width: `${cursorSize}px`,
      height: `${cursorSize}px`,
      borderRadius: "9999px",
      overflow: "visible",
      transition: "200ms, transform 10ms",
      userSelect: "none",
      pointerEvents: "none",
    }),
    []
  );

  useEffect(() => {
    const svg = svgRef.current;
    const blur = blurRef.current;
    if (!svg || !blur) return;

    const isFinePointer = window.matchMedia?.("(pointer: fine)")?.matches ?? true;
    if (!isFinePointer) return;

    const root = document.body;

    let position: Position = {
      distanceX: 0,
      distanceY: 0,
      pointerX: 0,
      pointerY: 0,
    };

    let previousPointerX = 0;
    let previousPointerY = 0;
    let angle = 0;
    let previousAngle = 0;
    let moving = false;
    let stopTimer: number | null = null;

    const stop = () => {
      if (stopTimer) window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(() => {
        blur.setAttribute("stdDeviation", "0, 0");
        moving = false;
      }, 50);
    };

    const rotate = () => {
      const unsortedAngle =
        Math.atan(Math.abs(position.distanceY) / Math.abs(position.distanceX)) * degrees;

      if (Number.isNaN(unsortedAngle)) {
        angle = previousAngle;
      } else if (unsortedAngle <= 45) {
        angle = position.distanceX * position.distanceY >= 0 ? +unsortedAngle : -unsortedAngle;
        blur.setAttribute("stdDeviation", `${Math.abs(position.distanceX / 2)}, 0`);
      } else {
        angle =
          position.distanceX * position.distanceY <= 0 ? 180 - unsortedAngle : unsortedAngle;
        blur.setAttribute("stdDeviation", `${Math.abs(position.distanceY / 2)}, 0`);
      }

      svg.style.transform += ` rotate(${angle}deg)`;
      previousAngle = angle;
    };

    const onMove = (event: MouseEvent) => {
      previousPointerX = position.pointerX;
      previousPointerY = position.pointerY;

      const rect = root.getBoundingClientRect();
      position.pointerX = event.pageX + rect.x;
      position.pointerY = event.pageY + rect.y;

      position.distanceX = clamp(previousPointerX - position.pointerX, -20, 20);
      position.distanceY = clamp(previousPointerY - position.pointerY, -20, 20);

      svg.style.transform = `translate3d(${position.pointerX}px, ${position.pointerY}px, 0)`;
      rotate();

      moving ? stop() : (moving = true);
    };

    document.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      document.removeEventListener("mousemove", onMove);
      if (stopTimer) window.clearTimeout(stopTimer);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className="curzr"
      aria-hidden="true"
      viewBox="0 0 100 100"
      style={cursorStyle}
    >
      <filter id="motionblur" x="-100%" y="-100%" width="400%" height="400%">
        <feGaussianBlur ref={blurRef} className="curzr-motion-blur" stdDeviation="0, 0" />
      </filter>
      <circle
        cx="50%"
        cy="50%"
        r="10"
        fill="hsl(var(--foreground) / 0.2)"
        filter="url(#motionblur)"
      />
    </svg>
  );
}
