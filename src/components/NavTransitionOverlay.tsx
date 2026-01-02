import { useEffect } from "react";
import { Play } from "lucide-react";
import { useNavTransition } from "@/contexts/NavTransitionContext";

export const NavTransitionOverlay = () => {
  const { isNavigating, label, stopNavigation } = useNavTransition();

  // Safety auto-stop so it never gets stuck.
  useEffect(() => {
    if (!isNavigating) return;
    const t = window.setTimeout(() => stopNavigation(), 1200);
    return () => window.clearTimeout(t);
  }, [isNavigating, stopNavigation]);

  if (!isNavigating) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm"
      style={{
        animation: "nav-overlay-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        willChange: "opacity, transform",
      }}
      aria-label="Opening player"
      role="status"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative w-24 h-24"
          style={{
            transform: "translateZ(0)",
          }}
        >
          <div className="absolute inset-0 rounded-full border border-white/10" />

          <div
            className="absolute inset-0 rounded-full"
            style={{
              animation: "smooth-spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
              willChange: "transform",
            }}
          >
            <div
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full"
              style={{ boxShadow: "0 0 12px 4px hsl(var(--primary) / 0.6)" }}
            />
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
              style={{ boxShadow: "inset 0 0 18px hsl(var(--primary) / 0.12)" }}
            >
              <Play className="w-6 h-6 text-primary fill-primary ml-0.5" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center">
        <p className="text-white/80 text-sm font-light">{label ?? "Opening player..."}</p>
      </div>

      <style>{`
        @keyframes nav-overlay-in {
          0% { opacity: 0; transform: scale(1.01); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes smooth-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
