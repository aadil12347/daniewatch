import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "dw_splash_seen_v1";

export function getShouldShowInitialSplash(): boolean {
  // Once per session: show only when the key is missing.
  try {
    const seen = sessionStorage.getItem(STORAGE_KEY);
    if (seen === "1") return false;
    // Set immediately so refresh won't re-trigger.
    sessionStorage.setItem(STORAGE_KEY, "1");
    return true;
  } catch {
    // If storage is blocked, fail open (show) but still keep it safe.
    return true;
  }
}

type Props = {
  onDone: () => void;
};

export function InitialSplashOverlay({ onDone }: Props) {
  const prefersReducedMotion = useMemo(() => {
    try {
      return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    } catch {
      return false;
    }
  }, []);

  // Keep the unmount strictly driven by time so nothing else renders underneath.
  const TOTAL_MS = prefersReducedMotion ? 450 : 3200;
  const FADE_OUT_MS = prefersReducedMotion ? 150 : 220;

  const [phase, setPhase] = useState<"open" | "closing">("open");

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = root.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    root.dataset.initialSplash = "1";
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const t1 = window.setTimeout(() => setPhase("closing"), Math.max(0, TOTAL_MS - FADE_OUT_MS));
    const t2 = window.setTimeout(() => {
      delete root.dataset.initialSplash;
      onDone();
    }, TOTAL_MS);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      delete root.dataset.initialSplash;
      root.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [FADE_OUT_MS, TOTAL_MS, onDone]);

  return (
    <div className="dw-splash" data-state={phase} role="status" aria-label="Welcome">
      <span className="dw-splash__puff" aria-hidden="true" />
      <span className="dw-splash__core" aria-hidden="true" />
      <div className="dw-splash__brand" aria-hidden="true">
        <span className="dw-splash__brandMark">Danie</span>
        <span className="dw-splash__brandMark dw-splash__brandMark--accent">Watch</span>
      </div>
    </div>
  );
}
