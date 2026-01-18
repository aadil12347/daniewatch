import { useEffect, useRef } from "react";

const isTouchDevice = () => {
  if (typeof window === "undefined") return true;
  return (
    "ontouchstart" in window ||
    (navigator?.maxTouchPoints ?? 0) > 0 ||
    // @ts-expect-error older browsers
    (navigator?.msMaxTouchPoints ?? 0) > 0
  );
};

type Position = {
  distanceX: number;
  distanceY: number;
  pointerX: number;
  pointerY: number;
};

export function ArrowCursor() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isTouchDevice()) return;

    const root = document.body;
    const cursor = rootRef.current;
    if (!cursor) return;

    // Hide the native cursor only while this component is mounted.
    document.documentElement.classList.add("cursor-arrow-enabled");

    const degrees = 57.296;
    const cursorSize = 20;

    const position: Position = {
      distanceX: 0,
      distanceY: 0,
      pointerX: 0,
      pointerY: 0,
    };

    let previousPointerX = 0;
    let previousPointerY = 0;
    let angle = 0;
    let previousAngle = 0;
    let angleDisplace = 0;

    const style = cursor.style;
    style.boxSizing = "border-box";
    style.position = "fixed";
    style.top = "0px";
    style.left = `${-cursorSize / 2}px`;
    style.zIndex = "2147483647";
    style.width = `${cursorSize}px`;
    style.height = `${cursorSize}px`;
    style.transition = "250ms, transform 100ms";
    style.userSelect = "none";
    style.pointerEvents = "none";

    cursor.removeAttribute("hidden");

    const rotate = (pos: Position) => {
      const unsortedAngle =
        Math.atan(Math.abs(pos.distanceY) / Math.abs(pos.distanceX)) * degrees;

      previousAngle = angle;

      if (pos.distanceX <= 0 && pos.distanceY >= 0) {
        angle = 90 - unsortedAngle + 0;
      } else if (pos.distanceX < 0 && pos.distanceY < 0) {
        angle = unsortedAngle + 90;
      } else if (pos.distanceX >= 0 && pos.distanceY <= 0) {
        angle = 90 - unsortedAngle + 180;
      } else if (pos.distanceX > 0 && pos.distanceY > 0) {
        angle = unsortedAngle + 270;
      }

      if (Number.isNaN(angle)) {
        angle = previousAngle;
      } else {
        if (angle - previousAngle <= -270) {
          angleDisplace += 360 + angle - previousAngle;
        } else if (angle - previousAngle >= 270) {
          angleDisplace += angle - previousAngle - 360;
        } else {
          angleDisplace += angle - previousAngle;
        }
      }

      style.transform += ` rotate(${angleDisplace}deg)`;

      // micro-adjust origin depending on direction
      setTimeout(() => {
        const modAngle =
          angleDisplace >= 0 ? angleDisplace % 360 : 360 + (angleDisplace % 360);

        if (modAngle >= 45 && modAngle < 135) {
          style.left = `${-cursorSize}px`;
          style.top = `${-cursorSize / 2}px`;
        } else if (modAngle >= 135 && modAngle < 225) {
          style.left = `${-cursorSize / 2}px`;
          style.top = `${-cursorSize}px`;
        } else if (modAngle >= 225 && modAngle < 315) {
          style.left = "0px";
          style.top = `${-cursorSize / 2}px`;
        } else {
          style.left = `${-cursorSize / 2}px`;
          style.top = "0px";
        }
      }, 0);
    };

    let raf = 0;
    const onMove = (event: MouseEvent) => {
      previousPointerX = position.pointerX;
      previousPointerY = position.pointerY;

      position.pointerX = event.pageX + root.getBoundingClientRect().x;
      position.pointerY = event.pageY + root.getBoundingClientRect().y;

      position.distanceX = previousPointerX - position.pointerX;
      position.distanceY = previousPointerY - position.pointerY;

      const distance = Math.sqrt(
        position.distanceY ** 2 + position.distanceX ** 2
      );

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        style.transform = `translate3d(${position.pointerX}px, ${position.pointerY}px, 0)`;

        if (distance > 1) {
          rotate(position);
        } else {
          style.transform += ` rotate(${angleDisplace}deg)`;
        }
      });
    };

    document.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.documentElement.classList.remove("cursor-arrow-enabled");
    };
  }, []);

  return (
    <div className="curzr" hidden ref={rootRef} aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <path
          className="inner"
          d="M25,30a5.82,5.82,0,0,1-1.09-.17l-.2-.07-7.36-3.48a.72.72,0,0,0-.35-.08.78.78,0,0,0-.33.07L8.24,29.54a.66.66,0,0,1-.2.06,5.17,5.17,0,0,1-1,.15,3.6,3.6,0,0,1-3.29-5L12.68,4.2a3.59,3.59,0,0,1,6.58,0l9,20.74A3.6,3.6,0,0,1,25,30Z"
        />
        <path
          className="outer"
          d="M16,3A2.59,2.59,0,0,1,18.34,4.6l9,20.74A2.59,2.59,0,0,1,25,29a5.42,5.42,0,0,1-.86-.15l-7.37-3.48a1.84,1.84,0,0,0-.77-.17,1.69,1.69,0,0,0-.73.16l-7.4,3.31a5.89,5.89,0,0,1-.79.12,2.59,2.59,0,0,1-2.37-3.62L13.6,4.6A2.58,2.58,0,0,1,16,3m0-2h0A4.58,4.58,0,0,0,11.76,3.8L2.84,24.33A4.58,4.58,0,0,0,7,30.75a6.08,6.08,0,0,0,1.21-.17,1.87,1.87,0,0,0,.4-.13L16,27.18l7.29,3.44a1.64,1.64,0,0,0,.39.14A6.37,6.37,0,0,0,25,31a4.59,4.59,0,0,0,4.21-6.41l-9-20.75A4.62,4.62,0,0,0,16,1Z"
        />
      </svg>
    </div>
  );
}
