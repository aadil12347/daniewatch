import { useEffect, useMemo, useState } from "react";
import { usePerformanceMode } from "@/contexts/PerformanceModeContext";

type OverlayPhase = "open" | "closing";

const DISPLAY_MS = 3000;
const CLOSE_MS = 220;

function splitForFit(phrase: string): { line1: string; line2: string } {
  // Prefer a 2-line layout so it always fits (especially on mobile).
  const parts = phrase.split(" ");
  if (parts.length >= 2) {
    return { line1: parts.slice(0, -1).join(" "), line2: parts[parts.length - 1] };
  }
  return { line1: phrase, line2: "" };
}

function Letters({ text }: { text: string }) {
  const chars = useMemo(() => Array.from(text), [text]);
  return (
    <span className="mode-switch-overlay__line" aria-hidden="true">
      {chars.map((ch, i) => {
        // Keep spaces as fixed gaps (no animation).
        if (ch === " ") {
          return (
            <span key={`sp-${i}`} className="mode-switch-overlay__space">
              {" "}
            </span>
          );
        }

        return (
          <span
            key={`${ch}-${i}`}
            className="mode-switch-overlay__letter"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

export function PerformanceModeSwitchOverlay() {
  const { lastSwitch } = usePerformanceMode();
  const [phase, setPhase] = useState<OverlayPhase>("open");
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (!lastSwitch) return;

    const phrase = lastSwitch.mode === "quality" ? "QUALITY MODE" : "PERFORMANCE MODE";
    setText(phrase);
    setPhase("open");
    setVisible(true);

    const closeTimer = window.setTimeout(() => setPhase("closing"), DISPLAY_MS);
    const unmountTimer = window.setTimeout(() => setVisible(false), DISPLAY_MS + CLOSE_MS);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [lastSwitch?.at, lastSwitch?.mode]);

  if (!visible) return null;

  const { line1, line2 } = splitForFit(text);

  return (
    <div
      className="mode-switch-overlay"
      data-state={phase}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      <div className="mode-switch-overlay__inner">
        <div className="mode-switch-overlay__text">
          <Letters text={line1} />
          {line2 ? <Letters text={line2} /> : null}
        </div>
      </div>
    </div>
  );
}
