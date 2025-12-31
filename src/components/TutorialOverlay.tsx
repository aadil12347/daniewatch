import { useEffect, useState } from "react";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialTooltip } from "./TutorialTooltip";
import { cn } from "@/lib/utils";
import { Home, Search, MessageSquarePlus, FileText, Sparkles } from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string | null;
  position: "top" | "bottom" | "left" | "right" | "center";
  icon: React.ReactNode;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to DanieWatch!",
    description: "Let us show you around! This quick tour will help you discover all the amazing features available to you. Let's get started!",
    targetSelector: null,
    position: "center",
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: "navigation",
    title: "Browse Categories",
    description: "Use the navigation menu to explore Movies, TV Shows, Anime, and Korean dramas. Each category has carefully curated content for you!",
    targetSelector: "[data-tutorial='navigation']",
    position: "bottom",
    icon: <Home className="w-5 h-5" />,
  },
  {
    id: "search",
    title: "Search Anything",
    description: "Looking for something specific? Click the search icon to instantly find any movie or TV show in our collection.",
    targetSelector: "[data-tutorial='search']",
    position: "bottom",
    icon: <Search className="w-5 h-5" />,
  },
  {
    id: "request",
    title: "Request Content",
    description: "Can't find what you're looking for? Use this button to request any movie or TV season, or contact us directly!",
    targetSelector: "[data-tutorial='request']",
    position: "top",
    icon: <MessageSquarePlus className="w-5 h-5" />,
  },
  {
    id: "my-requests",
    title: "Track Your Requests",
    description: "All your requests appear in 'My Requests' from your profile menu. You'll get notified when your request is approved or completed!",
    targetSelector: null,
    position: "center",
    icon: <FileText className="w-5 h-5" />,
  },
];

export const TutorialOverlay = () => {
  const { isTutorialActive, currentStep, totalSteps, nextStep, skipTutorial } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentStepData = tutorialSteps[currentStep];

  useEffect(() => {
    if (!isTutorialActive || !currentStepData?.targetSelector) {
      setTargetRect(null);
      return;
    }

    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);

    const findAndHighlight = () => {
      const target = document.querySelector(currentStepData.targetSelector!);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    findAndHighlight();
    
    // Re-calculate position on scroll/resize
    window.addEventListener("scroll", findAndHighlight, true);
    window.addEventListener("resize", findAndHighlight);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", findAndHighlight, true);
      window.removeEventListener("resize", findAndHighlight);
    };
  }, [isTutorialActive, currentStep, currentStepData?.targetSelector]);

  if (!isTutorialActive) return null;

  const isFullscreenStep = !currentStepData?.targetSelector;

  return (
    <div className="fixed inset-0 z-[150] pointer-events-auto">
      {/* Overlay with cutout */}
      {!isFullscreenStep && targetRect ? (
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="16"
                fill="black"
                className={cn(
                  "transition-all duration-500",
                  isAnimating && "animate-pulse"
                )}
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.85)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm" />
      )}

      {/* Spotlight glow effect */}
      {!isFullscreenStep && targetRect && (
        <div
          className="absolute pointer-events-none transition-all duration-500"
          style={{
            left: targetRect.left - 12,
            top: targetRect.top - 12,
            width: targetRect.width + 24,
            height: targetRect.height + 24,
          }}
        >
          <div className="absolute inset-0 rounded-2xl ring-2 ring-primary ring-offset-4 ring-offset-background animate-pulse" />
          <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
        </div>
      )}

      {/* Tooltip positioning */}
      {isFullscreenStep ? (
        // Centered modal for welcome/final steps
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="animate-scale-in">
            <TutorialTooltip
              title={currentStepData.title}
              description={currentStepData.description}
              icon={currentStepData.icon}
              position="center"
              currentStep={currentStep}
              totalSteps={totalSteps}
              onNext={nextStep}
              onSkip={skipTutorial}
              isLastStep={currentStep === totalSteps - 1}
            />
          </div>
        </div>
      ) : targetRect ? (
        // Positioned near target element
        <div
          className="absolute transition-all duration-500"
          style={{
            left: Math.min(
              Math.max(16, targetRect.left + targetRect.width / 2 - 160),
              window.innerWidth - 336
            ),
            top:
              currentStepData.position === "top"
                ? targetRect.top - 16
                : targetRect.bottom + 16,
          }}
        >
          <TutorialTooltip
            title={currentStepData.title}
            description={currentStepData.description}
            icon={currentStepData.icon}
            position={currentStepData.position}
            currentStep={currentStep}
            totalSteps={totalSteps}
            onNext={nextStep}
            onSkip={skipTutorial}
            isLastStep={currentStep === totalSteps - 1}
          />
        </div>
      ) : null}
    </div>
  );
};
