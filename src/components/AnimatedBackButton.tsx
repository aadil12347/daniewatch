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

  // Simplified styling - no animation, smaller size
  const rootCls =
    "flex items-center gap-1.5 font-medium backdrop-blur border border-border/60 " +
    (isNavbar
      ? "h-8 px-3 rounded-full bg-background/90 text-sm "
      : "h-10 px-4 rounded-xl bg-card/80 text-base ") +
    "text-foreground hover:bg-accent transition-colors " +
    (className ?? "");

  return (
    <button type="button" onClick={handleBack} className={rootCls} aria-label={label}>
      <ArrowLeft className={isNavbar ? "h-4 w-4" : "h-5 w-5"} />
      <span>{label}</span>
    </button>
  );
}

