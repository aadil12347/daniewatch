import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Props = {
  label?: string;
  className?: string;
  to?: string;
  /**
   * default: large CTA-style (like your example)
   * navbar: compact size to replace the existing sticky Navbar back button
   */
  size?: "default" | "navbar";
};

export function AnimatedBackButton({ label = "Go Back", className, to, size = "default" }: Props) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);
      return;
    }

    // If user landed directly on the details page (no history), go home.
    if (window.history.length <= 1) {
      navigate("/");
      return;
    }

    navigate(-1);
  };

  const isNavbar = size === "navbar";

  const rootCls =
    "group relative overflow-hidden border border-border/60 font-semibold backdrop-blur transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] " +
    (isNavbar
      ? "h-11 w-28 rounded-full bg-background/90 shadow-lg "
      : "h-12 w-44 md:h-14 md:w-48 rounded-2xl bg-card/80 shadow-card ") +
    "text-foreground " +
    (className ?? "");

  const pillCls =
    "absolute left-1 top-1 z-10 flex items-center justify-center bg-primary text-primary-foreground transition-[width] duration-500 ease-out group-hover:w-[calc(100%-0.5rem)] " +
    (isNavbar ? "h-9 w-9 rounded-full" : "h-10 w-12 rounded-xl");

  const labelCls = "relative z-0 block translate-x-2 " + (isNavbar ? "text-sm" : "text-base md:text-lg");

  return (
    <button type="button" onClick={handleBack} className={rootCls} aria-label={label}>
      <span className={pillCls}>
        <ArrowLeft className="h-5 w-5" />
      </span>
      <span className={labelCls}>{label}</span>
    </button>
  );
}

