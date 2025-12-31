import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronRight, X } from "lucide-react";

interface TutorialTooltipProps {
  title: string;
  description: string;
  icon?: ReactNode;
  position?: "top" | "bottom" | "left" | "right" | "center";
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  isLastStep?: boolean;
  hideDescription?: boolean;
}

export const TutorialTooltip = ({
  title,
  description,
  icon,
  position = "bottom",
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  isLastStep = false,
  hideDescription = false,
}: TutorialTooltipProps) => {
  const positionClasses = {
    top: "bottom-full mb-4",
    bottom: "top-full mt-4",
    left: "right-full mr-4",
    right: "left-full ml-4",
    center: "",
  };

  const arrowClasses = {
    top: "bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-l-transparent border-r-transparent border-b-transparent border-t-card",
    bottom: "top-0 left-1/2 -translate-x-1/2 -translate-y-full border-l-transparent border-r-transparent border-t-transparent border-b-card",
    left: "right-0 top-1/2 -translate-y-1/2 translate-x-full border-t-transparent border-b-transparent border-r-transparent border-l-card",
    right: "left-0 top-1/2 -translate-y-1/2 -translate-x-full border-t-transparent border-b-transparent border-l-transparent border-r-card",
    center: "hidden",
  };

  return (
    <div
      className={cn(
        "absolute z-[200] w-80 animate-fade-in",
        position === "center" ? "relative" : positionClasses[position]
      )}
    >
      {/* Arrow */}
      {position !== "center" && (
        <div
          className={cn(
            "absolute w-0 h-0 border-8",
            arrowClasses[position]
          )}
        />
      )}

      {/* Card */}
      <div className="bg-card border border-border rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-5 py-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                  {icon}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">
                  Step {currentStep + 1} of {totalSteps}
                </p>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Skip tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!hideDescription && description && (
          <div className="px-5 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 bg-secondary/20 border-t border-border/50 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  i === currentStep
                    ? "bg-primary w-6"
                    : i < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Action button */}
          <Button
            onClick={onNext}
            size="sm"
            className="gap-1.5 rounded-xl"
          >
            {isLastStep ? "Get Started" : "Next"}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
