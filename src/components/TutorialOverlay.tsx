import { useEffect, useState, useCallback } from "react";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialTooltip } from "./TutorialTooltip";
import { cn } from "@/lib/utils";
import { Home, Search, MessageSquarePlus, FileText, Sparkles, PartyPopper, Check, Info, Menu } from "lucide-react";

// Base64 encoded sound effects (short, subtle sounds)
const WHOOSH_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdnd3eXd3dnl6enp4eHd1dHNycnFxcXFxcXFyc3R1d3h5enp6e3t6enp5eHd2dXRzcnFxcHBwcHBwcXFycnR1dnh5e3x9fn5+fn59fHt6eXh3dnV0c3JxcHBvb29vb29wcHFyc3R2d3l6fH1+f4CAgICAf39+fXx7enl4d3Z1dHNycXBwb29vb29vb3BwcXJzdHV3eHp7fH1+f4CAgICAgIB/f359fHt6eXh3dnV0c3JxcHBvb29vb29vb3BwcXJzdHV2eHl6e3x9fn9/gICAf39/fn59fHt6eXh3dnV0c3JxcXBwb29vbm5ub29vcHBxcnN0dXZ3eXp7fH1+fn9/f39/fn5+fXx7enl4d3Z1dHNycnFwcG9vb29vbm5ub29vcHBxcnN0dXZ3eHl6e3x9fX5+fn5+fn19fHt6eXh3dnZ1dHNycXFwb29vbm5ubm5ub29vcHBxcnN0dXZ3eHl6e3t8fX19fX19fX18e3p5eHd2dXR0c3JxcXBvb29ubm5ubm5ub29vcHBxcnN0dXZ2d3h5ent7fHx8fX19fHx7enl4d3Z1dHNzc3JxcHBvb29ubm5ubm5ub29vcHBxcnN0dXZ2d3h5ent7fHx8fHx8e3t6eXh3dnV0dHNycnFwcG9vbm5ubm5ubm5ub29vcHBxcnN0dXV2d3h5enp7e3t7e3t7e3p5eHd2dXR0c3NycXFwb29vbm5ubm5ubm5ub29vcHBxcnN0dXV2d3d4eXl6enp6enp6eXl4d3Z1dHRzc3JxcHBvb29ubm5ubm5ubm5vb29wcHFyc3R0dXZ2d3d4eXl5eXl5eXl4eHd2dXR0c3NycXFwb29vbm5ubm5ubm5ub29vcHBxcnN0dHV1dnd3eHh4eHh4eHh3d3Z1dHRzc3JycXBwb29vbm5ubm5ubm5ub29vcHBxcnJzc3R1dXZ2d3d3d3d3d3d2dnV0dHNzc3JxcXBvb29ubm5ubm5ubm5ub29vcHBxcXJyc3R0dXV2dnZ2dnZ2dnV1dHRzc3JycXFwcG9vb25ubm5ubm5ubm5vb29wcHFxcnJzc3R0dXV1dXV1dXV0dHRzc3JycXFwcG9vb29ubm5ubm5ubm5ub29vcHBwcXFycnJzc3R0dHR0dHR0c3NzcnJxcXBwb29vb25ubm5ubm5ubm5ub29vcHBwcXFxcnJyc3Nzc3Nzc3Nzc3NycnFxcXBwb29vb25ubm5ubm5ubm5ub29vcHBwcHFxcXJycnJycnJycnJycnJycXFwcHBvb29vbm5ubm5ubm5ubm5ub29vcHBwcHFxcXFxcXJycnJycnJxcXFwcHBvb29vb25ubm5ubm5ubm5ub29vcHBwcHBwcXFxcXFxcXFxcXFxcHBwb29vb29vbm5ubm5ubm5ubm5ub29vcHBwcHBwcHFxcXFxcXFxcHBwb29vb29vb25ubm5ubm5ubm5ubm5vb29wcHBwcHBwcHBwcXFwcHBwb29vb29vb25ubm5ubm5ubm5ubm5vb29wcHBwcHBwcHBwcHBwcHBvb29vb29ubm5ubm5ubm5ubm5ubm9vb29wcHBwcHBwcHBwcHBvb29vb29vbm5ubm5ubm5ubm5ubm5vb29vb3BwcHBwcHBwcHBvb29vb29vb25ubm5ubm5ubm5ubm5ub29vb29wcHBwcHBwcHBwb29vb29vb29ubm5ubm5ubm5ubm5ubm1vb29vb29wcHBwcHBwcG9vb29vb29vbm5ubm5ubm5ubm5ubm5ub29vb29vb29wcHBwcG9vb29vb29vb25ubm5ubm5ubm5ubm5ubm5vb29vb29vb3Bwb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5vb29vb29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb29vbm5ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5ubm5vb29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ubm9vb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5ubm5vb29vb29vb29vb29vb29vbm5ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ubm9vb29vb29vb29vb29vb25ubm5ubm5u";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string | null;
  position: "top" | "bottom" | "left" | "right" | "center";
  icon: React.ReactNode;
  showDemoRequest?: boolean;
  showInfoBox?: boolean;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to DanieWatch!",
    description: "Chaliye hum aap ko sab kuch dikhate hain! Yeh quick tour aap ko saari features samjhne mein madad karega.",
    targetSelector: null,
    position: "center",
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: "navigation",
    title: "Browse Categories",
    description: "Yaha click karain Movies, TV Shows, Anime, aur Korean dramas dekhne ke liye. Har category mein behtareen content hai!",
    targetSelector: "[data-tutorial='navigation']",
    position: "bottom",
    icon: <Home className="w-5 h-5" />,
  },
  {
    id: "search",
    title: "Search Anything",
    description: "Kuch bhi dhund rahe ho? Search icon par click karain aur foran apni movie ya show dhundein!",
    targetSelector: "[data-tutorial='search']",
    position: "bottom",
    icon: <Search className="w-5 h-5" />,
  },
  {
    id: "request",
    title: "Request Content",
    description: "Koi movie ya show chahiye? Is floating button par click karain aur admin se request karain. Admin jaldi upload kar dega!",
    targetSelector: "[data-tutorial='request']",
    position: "top",
    icon: <MessageSquarePlus className="w-5 h-5" />,
  },
  {
    id: "my-requests",
    title: "Your Requests",
    description: "Aap ki saari requests yaha dikhengi. Jab admin complete karega, green badge aur response dikhega!",
    targetSelector: null,
    position: "center",
    icon: <FileText className="w-5 h-5" />,
    showDemoRequest: true,
  },
  {
    id: "celebration",
    title: "You're All Set!",
    description: "",
    targetSelector: null,
    position: "center",
    icon: <PartyPopper className="w-5 h-5" />,
    showInfoBox: true,
  },
];

// Demo Request Card Component
const DemoRequestCard = () => (
  <div className="bg-card/90 backdrop-blur-xl rounded-2xl p-4 border border-border/50 max-w-sm mt-4 shadow-xl">
    {/* Header */}
    <div className="flex justify-between items-start mb-3">
      <div>
        <h4 className="font-semibold text-foreground">Inception (2010)</h4>
        <p className="text-xs text-muted-foreground">Movie Request</p>
      </div>
      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
        <Check className="w-3 h-3" /> Completed
      </span>
    </div>
    
    {/* User Message */}
    <p className="text-sm text-muted-foreground mb-3 italic">
      "Hindi dubbed mein upload kar dein please"
    </p>
    
    {/* Admin Response */}
    <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
      <p className="text-xs text-primary font-medium mb-1">Admin Response:</p>
      <p className="text-sm text-foreground">
        Movie upload ho gaya hai! Ab aap dekh sakte ho. Enjoy karo! 🎬
      </p>
    </div>
    
    {/* Demo Label */}
    <div className="mt-3 text-center">
      <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-1 rounded">DEMO</span>
    </div>
  </div>
);

// Important Info Box Component
const ImportantInfoBox = () => (
  <div className="mt-6 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-xl p-4 border border-primary/30 max-w-sm">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
        <Info className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h4 className="font-semibold text-primary mb-1">Yaad Rakhein!</h4>
        <p className="text-sm text-foreground/90">
          Agar kisi movie ya season ka download link nahi available hai, to admin ko request kar saktay hain aur wo add kar day ga! 🎬
        </p>
      </div>
    </div>
  </div>
);

export const TutorialOverlay = () => {
  const { isTutorialActive, currentStep, totalSteps, nextStep, skipTutorial } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Get steps based on device
  const getSteps = (): TutorialStep[] => [
    {
      id: "welcome",
      title: "Welcome to DanieWatch!",
      description: "Chaliye hum aap ko sab kuch dikhate hain! Yeh quick tour aap ko saari features samjhne mein madad karega.",
      targetSelector: null,
      position: "center",
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      id: "navigation",
      title: isMobile ? "Open Menu" : "Browse Categories",
      description: isMobile
        ? "Is menu icon par tap karain. Yaha se aap Movies, TV Shows, Anime, Korean dramas aur apni Watchlist dekh sakte ho!"
        : "Yaha click karain Movies, TV Shows, Anime, aur Korean dramas dekhne ke liye. Har category mein behtareen content hai!",
      targetSelector: isMobile ? "[data-tutorial='mobile-menu']" : "[data-tutorial='navigation']",
      position: "bottom",
      icon: isMobile ? <Menu className="w-5 h-5" /> : <Home className="w-5 h-5" />,
    },
    {
      id: "search",
      title: "Search Anything",
      description: isMobile
        ? "Kuch bhi dhund rahe ho? Search icon par tap karain aur foran apni movie ya show dhundein!"
        : "Kuch bhi dhund rahe ho? Search icon par click karain aur foran apni movie ya show dhundein!",
      targetSelector: "[data-tutorial='search']",
      position: "bottom",
      icon: <Search className="w-5 h-5" />,
    },
    {
      id: "request",
      title: "Request Content",
      description: isMobile
        ? "Koi movie ya show chahiye? Is floating button par tap karain aur admin se request karain!"
        : "Koi movie ya show chahiye? Is floating button par click karain aur admin se request karain!",
      targetSelector: "[data-tutorial='request']",
      position: "top",
      icon: <MessageSquarePlus className="w-5 h-5" />,
    },
    {
      id: "my-requests",
      title: "Your Requests",
      description: "Aap ki saari requests yaha dikhengi. Jab admin complete karega, green badge aur response dikhega!",
      targetSelector: null,
      position: "center",
      icon: <FileText className="w-5 h-5" />,
      showDemoRequest: true,
    },
    {
      id: "celebration",
      title: "You're All Set!",
      description: "",
      targetSelector: null,
      position: "center",
      icon: <PartyPopper className="w-5 h-5" />,
      showInfoBox: true,
    },
  ];

  const currentStepData = getSteps()[currentStep];
  const isLastStep = currentStep === totalSteps - 1;

  // Sound utility functions
  const playSound = useCallback((soundData: string, volume: number = 0.3) => {
    try {
      const audio = new Audio(soundData);
      audio.volume = volume;
      audio.play().catch(() => {}); // Silently fail if blocked
    } catch (e) {
      // Audio not supported, fail silently
    }
  }, []);

  const playWhoosh = useCallback(() => {
    playSound(WHOOSH_SOUND, 0.25);
  }, [playSound]);

  // Play whoosh sound on step transitions
  useEffect(() => {
    if (isTutorialActive && currentStep > 0) {
      playWhoosh();
    }
  }, [currentStep, isTutorialActive, playWhoosh]);

  useEffect(() => {
    if (!isTutorialActive || !currentStepData?.targetSelector) {
      setTargetRect(null);
      return;
    }

    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);

    let cancelled = false;
    let retryTimer: number | undefined;

    const selector = currentStepData.targetSelector;

    const findAndHighlight = (opts?: { logIfMissing?: boolean }) => {
      if (cancelled) return;

      const target = document.querySelector(selector);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
        return true;
      }

      setTargetRect(null);

      if (opts?.logIfMissing) {
        console.warn("[TutorialOverlay] Target element not found", {
          stepId: currentStepData.id,
          selector,
          isMobile,
          href: window.location.href,
        });
      }

      return false;
    };

    // Initial attempt + short retry window (helps right after login / route transitions)
    let attempts = 0;
    const tryFindWithRetries = () => {
      if (cancelled) return;
      attempts += 1;

      const found = findAndHighlight({ logIfMissing: attempts === 10 });
      if (!found && attempts < 10) {
        retryTimer = window.setTimeout(tryFindWithRetries, 100);
      }
    };

    tryFindWithRetries();

    // Re-calculate position on scroll/resize
    window.addEventListener("scroll", findAndHighlight as any, true);
    window.addEventListener("resize", findAndHighlight as any);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener("scroll", findAndHighlight as any, true);
      window.removeEventListener("resize", findAndHighlight as any);
    };
  }, [isTutorialActive, currentStep, currentStepData?.targetSelector, currentStepData?.id, isMobile]);

  // Emergency exit: ESC closes tutorial
  useEffect(() => {
    if (!isTutorialActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipTutorial();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTutorialActive, skipTutorial]);

  if (!isTutorialActive) return null;

  const isTargetedStep = !!currentStepData?.targetSelector;
  const isTargetMissing = isTargetedStep && !targetRect;
  const isFullscreenStep = !isTargetedStep || isTargetMissing;

  const safeDescription = isTargetMissing
    ? `${currentStepData.description} (Agar highlight nazar na aaye, “Next” dabaa kar aglay step par chalein ya X se skip kar dein.)`
    : currentStepData.description;

  return (
    <>
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
                  className={cn("transition-all duration-500", isAnimating && "animate-pulse")}
                />
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0, 0, 0, 0.85)" mask="url(#spotlight-mask)" />
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
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="animate-scale-in flex flex-col items-center">
              <TutorialTooltip
                title={currentStepData.title}
                description={safeDescription}
                icon={currentStepData.icon}
                position="center"
                currentStep={currentStep}
                totalSteps={totalSteps}
                onNext={nextStep}
                onSkip={skipTutorial}
                isLastStep={isLastStep}
              />
              {currentStepData.showDemoRequest && <DemoRequestCard />}
              {currentStepData.showInfoBox && <ImportantInfoBox />}
            </div>
          </div>
        ) : targetRect ? (
          <div
            className="absolute transition-all duration-500"
            style={{
              left: Math.min(Math.max(16, targetRect.left + targetRect.width / 2 - 160), window.innerWidth - 336),
              top: currentStepData.position === "top" ? targetRect.top - 16 : targetRect.bottom + 16,
            }}
          >
            <TutorialTooltip
              title={currentStepData.title}
              description={safeDescription}
              icon={currentStepData.icon}
              position={currentStepData.position}
              currentStep={currentStep}
              totalSteps={totalSteps}
              onNext={nextStep}
              onSkip={skipTutorial}
              isLastStep={isLastStep}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};

