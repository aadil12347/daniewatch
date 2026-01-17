import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Props = {
  label?: string;
  className?: string;
  to?: string;
};

export function AnimatedBackButton({ label = "Go Back", className, to }: Props) {
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

  return (
    <button
      type="button"
      onClick={handleBack}
      className={
        "group relative h-12 w-44 md:h-14 md:w-48 rounded-2xl bg-card/80 backdrop-blur border border-border/60 text-foreground font-semibold overflow-hidden shadow-card " +
        "transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] " +
        (className ?? "")
      }
      aria-label={label}
    >
      {/* sliding pill */}
      <span
        className={
          "absolute left-1 top-1 z-10 flex h-10 w-12 items-center justify-center rounded-xl " +
          "bg-primary text-primary-foreground transition-[width] duration-500 ease-out " +
          "group-hover:w-[calc(100%-0.5rem)]"
        }
      >
        <ArrowLeft className="h-5 w-5" />
      </span>

      <span className="relative z-0 block translate-x-2 text-base md:text-lg">{label}</span>
    </button>
  );
}
