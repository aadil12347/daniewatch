// Lightweight poster-to-modal transition (no extra deps)

let overlayEl: HTMLDivElement | null = null;
let activeAnimation: Animation | null = null;
let inFlight = false;

const OVERLAY_ID = "poster-expand-overlay";

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function getHeaderOffsetPx() {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--app-header-offset");
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) ? px : 0;
}

function ensureOverlay() {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (existing) return existing;

  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.style.position = "fixed";
  el.style.inset = "0";
  el.style.pointerEvents = "none";
  el.style.zIndex = "60"; // above DialogContent z-40, below Navbar z-50 still ok because we avoid header area
  el.style.perspective = "1200px";
  document.body.appendChild(el);
  return el;
}

export type PosterExpandTransitionOptions = {
  sourceEl: HTMLElement;
  imageSrc: string;
  /** Optional: match your card radius (Tailwind rounded-xl ~= 12px) */
  startRadiusPx?: number;
  /** Optional: used when you want a tiny end radius instead of edge-to-edge */
  endRadiusPx?: number;
  /** Called when we should navigate to the modal route */
  onNavigate: () => void;
};

export function startPosterExpandTransition(options: PosterExpandTransitionOptions) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    options.onNavigate();
    return;
  }

  if (prefersReducedMotion()) {
    options.onNavigate();
    return;
  }

  if (inFlight) return;
  inFlight = true;

  const { sourceEl, imageSrc, startRadiusPx = 12, endRadiusPx = 0, onNavigate } = options;

  const startRect = sourceEl.getBoundingClientRect();
  const headerOffset = getHeaderOffsetPx();
  const endRect = {
    left: 0,
    top: headerOffset,
    width: window.innerWidth,
    height: Math.max(0, window.innerHeight - headerOffset),
  };

  overlayEl = ensureOverlay();
  if (!overlayEl) {
    inFlight = false;
    onNavigate();
    return;
  }

  // Clear any previous
  overlayEl.innerHTML = "";

  const stage = document.createElement("div");
  stage.style.position = "absolute";
  stage.style.left = "0";
  stage.style.top = "0";
  stage.style.width = "100%";
  stage.style.height = "100%";
  stage.style.transformStyle = "preserve-3d";

  const clone = document.createElement("div");
  clone.style.position = "fixed";
  clone.style.left = `${startRect.left}px`;
  clone.style.top = `${startRect.top}px`;
  clone.style.width = `${startRect.width}px`;
  clone.style.height = `${startRect.height}px`;
  clone.style.borderRadius = `${startRadiusPx}px`;
  clone.style.overflow = "hidden";
  clone.style.transformOrigin = "center center";
  clone.style.willChange = "transform, border-radius, opacity";
  clone.style.boxShadow = "0 20px 60px -20px rgba(0,0,0,.6)";
  clone.style.background = "transparent";

  const img = document.createElement("img");
  img.src = imageSrc;
  img.alt = "";
  img.decoding = "async";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.display = "block";

  clone.appendChild(img);
  stage.appendChild(clone);
  overlayEl.appendChild(stage);

  document.documentElement.dataset.posterExpanding = "1";

  const dx = endRect.left - startRect.left;
  const dy = endRect.top - startRect.top;
  const sx = startRect.width > 0 ? endRect.width / startRect.width : 1;
  const sy = startRect.height > 0 ? endRect.height / startRect.height : 1;

  // We animate via transform on the clone (GPU friendly)
  const keyframes: Keyframe[] = [
    {
      transform: `translate3d(0px, 0px, 0px) rotateX(-8deg) rotateY(14deg) scale3d(1,1,1)`,
      borderRadius: `${startRadiusPx}px`,
      opacity: 1,
    },
    {
      transform: `translate3d(${dx}px, ${dy}px, 0px) rotateX(0deg) rotateY(0deg) scale3d(${sx}, ${sy}, 1)`,
      borderRadius: `${endRadiusPx}px`,
      opacity: 1,
    },
  ];

  const timing: KeyframeAnimationOptions = {
    duration: 620,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    fill: "forwards",
  };

  activeAnimation?.cancel();
  activeAnimation = clone.animate(keyframes, timing);

  // Navigate as the stretch is underway so the modal can mount behind it.
  const navTimer = window.setTimeout(() => {
    try {
      onNavigate();
    } catch {
      // ignore
    }
  }, 360);

  activeAnimation.onfinish = () => {
    window.clearTimeout(navTimer);
    // We keep overlay until modal calls finishPosterExpandTransition()
    // but ensure we at least clear the inFlight flag.
    inFlight = false;
  };

  activeAnimation.oncancel = () => {
    window.clearTimeout(navTimer);
    inFlight = false;
  };
}

export function finishPosterExpandTransition() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const el = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (!el) {
    delete document.documentElement.dataset.posterExpanding;
    inFlight = false;
    return;
  }

  // Quick fade then remove
  el.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 140,
    easing: "ease-out",
    fill: "forwards",
  }).onfinish = () => {
    el.remove();
  };

  delete document.documentElement.dataset.posterExpanding;
  inFlight = false;
  activeAnimation?.cancel();
  activeAnimation = null;
  overlayEl = null;
}
