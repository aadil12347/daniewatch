import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "dw_splash_seen_v2";

export function getShouldShowInitialSplash(): boolean {
  // Use a combination of sessionStorage (per tab) and a session cookie (per browser session, shared across tabs)
  try {
    // 1. Check if seen in this specific tab session
    const seenInSession = sessionStorage.getItem(STORAGE_KEY);
    if (seenInSession === "1") {
      return false;
    }

    // 2. Check if seen in any other tab during this browser session (via session cookie)
    // A cookie without an expiry/max-age clears when the browser is closed.
    const isCookieSet = document.cookie.split(';').some((item) => item.trim().startsWith(STORAGE_KEY + '='));
    if (isCookieSet) {
      // It was seen in another tab this session. Mark this tab too.
      sessionStorage.setItem(STORAGE_KEY, "1");
      return false;
    }

    // 3. True first time this browser session: set both and show splash
    // We use Path=/ so it's consistent across all routes.
    document.cookie = `${STORAGE_KEY}=1; Path=/; SameSite=Lax`;
    sessionStorage.setItem(STORAGE_KEY, "1");
    return true;
  } catch (err) {
    // Fail safe on restricted environments
    console.warn("[Splash] Storage/Cookie access blocked:", err);
    return false;
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
