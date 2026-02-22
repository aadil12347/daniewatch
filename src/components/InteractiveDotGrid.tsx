import { useEffect, useRef, useCallback } from "react";
import { usePerformanceMode } from "@/contexts/PerformanceModeContext";

/**
 * InteractiveDotGrid
 * ------------------
 * A full-viewport canvas that renders a subtle grid of dots.
 * Dots near the mouse cursor gently displace outward and
 * shift toward the site's primary red hue.
 *
 * Automatically disabled in Performance mode to save GPU.
 */

interface Dot {
  /** Grid origin X */
  ox: number;
  /** Grid origin Y */
  oy: number;
  /** Current rendered X */
  x: number;
  /** Current rendered Y */
  y: number;
  /** Base radius */
  r: number;
  /** Current alpha (0-1) */
  alpha: number;
}

// Config
const GAP = 32; // px between dots
const BASE_RADIUS = 1.2;
const BASE_ALPHA = 0.06;
const MOUSE_RADIUS = 140; // px — interaction zone
const PUSH_STRENGTH = 14; // px — max displacement
const COLOR_STRENGTH = 0.16; // max alpha for red glow
const LERP = 0.08; // easing speed

export function InteractiveDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(0);
  const { isPerformance } = usePerformanceMode();

  // Build dot grid based on canvas size
  const buildGrid = useCallback((w: number, h: number) => {
    const dots: Dot[] = [];
    const cols = Math.ceil(w / GAP) + 1;
    const rows = Math.ceil(h / GAP) + 1;
    const offsetX = (w - (cols - 1) * GAP) / 2;
    const offsetY = (h - (rows - 1) * GAP) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ox = offsetX + col * GAP;
        const oy = offsetY + row * GAP;
        dots.push({ ox, oy, x: ox, y: oy, r: BASE_RADIUS, alpha: BASE_ALPHA });
      }
    }
    return dots;
  }, []);

  useEffect(() => {
    if (isPerformance) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dotsRef.current = buildGrid(w, h);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const onMouseLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };

    const draw = () => {
      if (!running) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const dots = dotsRef.current;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        // Distance from mouse to dot origin
        const dx = dot.ox - mx;
        const dy = dot.oy - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetX = dot.ox;
        let targetY = dot.oy;
        let targetAlpha = BASE_ALPHA;

        if (dist < MOUSE_RADIUS && dist > 0) {
          // Normalized push: stronger when closer
          const factor = 1 - dist / MOUSE_RADIUS;
          const factorSq = factor * factor; // ease-in curve
          const pushX = (dx / dist) * PUSH_STRENGTH * factorSq;
          const pushY = (dy / dist) * PUSH_STRENGTH * factorSq;
          targetX = dot.ox + pushX;
          targetY = dot.oy + pushY;
          targetAlpha = BASE_ALPHA + COLOR_STRENGTH * factorSq;
        }

        // Lerp toward target
        dot.x += (targetX - dot.x) * LERP;
        dot.y += (targetY - dot.y) * LERP;
        dot.alpha += (targetAlpha - dot.alpha) * LERP;

        // Draw the dot
        // Base color: warm grey. Near mouse: shift to primary red
        const redInfluence = Math.max(0, (dot.alpha - BASE_ALPHA) / COLOR_STRENGTH);

        // Warm grey base: rgb(120, 115, 112), red accent: rgb(217, 45, 32) — hsl(0, 84%, 49%)
        const r = Math.round(120 + (217 - 120) * redInfluence);
        const g = Math.round(115 + (45 - 115) * redInfluence);
        const b = Math.round(112 + (32 - 112) * redInfluence);

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${dot.alpha})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [isPerformance, buildGrid]);

  // Don't render anything in performance mode
  if (isPerformance) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="interactive-dot-grid"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        willChange: "transform",
      }}
    />
  );
}
