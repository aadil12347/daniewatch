import { useEffect } from "react";

type Options = {
  enabled?: boolean;
};

export function useContainerScrollCache(el: Element | null, key: string, options: Options = {}) {
  const enabled = options.enabled ?? true;

  // Restore.
  useEffect(() => {
    if (!enabled) return;
    if (!el) return;
    if (!(el instanceof HTMLElement)) return;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const y = Number(raw);
      if (!Number.isFinite(y)) return;
      el.scrollTop = y;
    } catch {
      // ignore
    }
  }, [el, enabled, key]);

  // Save (throttled).
  useEffect(() => {
    if (!enabled) return;
    if (!el) return;
    if (!(el instanceof HTMLElement)) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        try {
          sessionStorage.setItem(key, String(el.scrollTop));
        } catch {
          // ignore
        }
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [el, enabled, key]);
}
