import { useEffect, useState, useCallback } from "react";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialTooltip } from "./TutorialTooltip";
import { cn } from "@/lib/utils";
import { Home, Search, MessageSquarePlus, FileText, Sparkles, PartyPopper, Check, Info } from "lucide-react";
import confetti from "canvas-confetti";

// Base64 encoded sound effects (short, subtle sounds)
const WHOOSH_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdnd3eXd3dnl6enp4eHd1dHNycnFxcXFxcXFyc3R1d3h5enp6e3t6enp5eHd2dXRzcnFxcHBwcHBwcXFycnR1dnh5e3x9fn5+fn59fHt6eXh3dnV0c3JxcHBvb29vb29wcHFyc3R2d3l6fH1+f4CAgICAf39+fXx7enl4d3Z1dHNycXBwb29vb29vb3BwcXJzdHV3eHp7fH1+f4CAgICAgIB/f359fHt6eXh3dnV0c3JxcHBvb29vb29vb3BwcXJzdHV2eHl6e3x9fn9/gICAf39/fn59fHt6eXh3dnV0c3JxcXBwb29vbm5ub29vcHBxcnN0dXZ3eXp7fH1+fn9/f39/fn5+fXx7enl4d3Z1dHNycnFwcG9vb29vbm5ub29vcHBxcnN0dXZ3eHl6e3x9fX5+fn5+fn19fHt6eXh3dnZ1dHNycXFwb29vbm5ubm5ub29vcHBxcnN0dXZ3eHl6e3t8fX19fX19fX18e3p5eHd2dXR0c3JxcXBvb29ubm5ubm5ub29vcHBxcnN0dXZ2d3h5ent7fHx8fX19fHx7enl4d3Z1dHNzc3JxcHBvb29ubm5ubm5ub29vcHBxcnN0dXZ2d3h5ent7fHx8fHx8e3t6eXh3dnV0dHNycnFwcG9vbm5ubm5ubm5ub29vcHBxcnN0dXV2d3h5enp7e3t7e3t7e3p5eHd2dXR0c3NycXFwb29vbm5ubm5ubm5ub29vcHBxcnN0dXV2d3d4eXl6enp6enp6eXl4d3Z1dHRzc3JxcHBvb29ubm5ubm5ubm5vb29wcHFyc3R0dXZ2d3d4eXl5eXl5eXl4eHd2dXR0c3NycXFwb29vbm5ubm5ubm5ub29vcHBxcnN0dHV1dnd3eHh4eHh4eHh3d3Z1dHRzc3JycXBwb29vbm5ubm5ubm5ub29vcHBxcnJzc3R1dXZ2d3d3d3d3d3d2dnV0dHNzc3JxcXBvb29ubm5ubm5ubm5ub29vcHBxcXJyc3R0dXV2dnZ2dnZ2dnV1dHRzc3JycXFwcG9vb25ubm5ubm5ubm5vb29wcHFxcnJzc3R0dXV1dXV1dXV0dHRzc3JycXFwcG9vb29ubm5ubm5ubm5ub29vcHBwcXFycnJzc3R0dHR0dHR0c3NzcnJxcXBwb29vb25ubm5ubm5ubm5ub29vcHBwcXFxcnJyc3Nzc3Nzc3Nzc3NycnFxcXBwb29vb25ubm5ubm5ubm5ub29vcHBwcHFxcXJycnJycnJycnJycnJycXFwcHBvb29vbm5ubm5ubm5ubm5ub29vcHBwcHFxcXFxcXJycnJycnJxcXFwcHBvb29vb25ubm5ubm5ubm5ub29vcHBwcHBwcXFxcXFxcXFxcXFxcHBwb29vb29vbm5ubm5ubm5ubm5ub29vcHBwcHBwcHFxcXFxcXFxcHBwb29vb29vb25ubm5ubm5ubm5ubm5vb29wcHBwcHBwcHBwcXFwcHBwb29vb29vb25ubm5ubm5ubm5ubm5vb29wcHBwcHBwcHBwcHBwcHBvb29vb29ubm5ubm5ubm5ubm5ubm9vb29wcHBwcHBwcHBwcHBvb29vb29vbm5ubm5ubm5ubm5ubm5vb29vb3BwcHBwcHBwcHBvb29vb29vb25ubm5ubm5ubm5ubm5ub29vb29wcHBwcHBwcHBwb29vb29vb29ubm5ubm5ubm5ubm5ubm5vb29vb29wcHBwcHBwcG9vb29vb29vbm5ubm5ubm5ubm5ubm5ub29vb29vb29wcHBwcG9vb29vb29vb25ubm5ubm5ubm5ubm5ubm5vb29vb29vb3Bwb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5vb29vb29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb29vbm5ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5ubm5vb29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ubm9vb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5ubm5vb29vb29vb29vb29vb29vbm5ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ubm9vb29vb29vb29vb29vb25ubm5ubm5u";

const CELEBRATION_SOUND = "data:audio/wav;base64,UklGRlQHAABXQVZFZm10IBAAAAABAAEAIlYAAIhPAAACABAAZGF0YTAHAABAgIB/f4CAf4CAgH+AgIB/f4CAgH+AgICCh42SlaGmqK2vsbKzs7KxsK6sqaWhnpiUkI2Kg4B9end1cnBubWxramlpaWhpaWlpamtra21ub3FzdXh6fX+BhIaIio2PkZOVl5mam5ycnJuamZiWlJKQjo2LiYiGhIOCgYB/fn18e3p5eHd3d3d3d3h4eXp7fH1+f4CBgoOEhYaHiImKi4yNjo+QkJGSk5OUlJSUlJSUk5OTkpKRkJCPjo2MioqIh4aFhIOCgYB/fn18e3t6eXl4eHd3d3d3d3d4eHl5ent8fX5/gIGCg4SGh4iJiouMjY6PkJGRkpKTk5OTk5OTkpKRkZCPjo2Mi4qJiIeGhYOCgYB/fn18e3p5eXh4d3d3d3d3d3h4eXp6e3x9fn+AgYKDhIWGh4iJi4yNjo+QkJGRkpKSk5OTkpKSkZGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enp5eHh3d3d3d3d3eHh5enp7fH1+f4CAgYOEhYaHiImKi4yNjo6PkJCQkZGRkZGRkZCQkI+Ojo2Mi4qJiIeGhYSDgoGAf359fHt6eXl4eHd3d3d3d3d4eHl5ent7fH1+f4CAgYKDhIWGh4iJiouMjY2Ojo+Pj5CQkJCQkJCPj4+OjY2MiomIh4aGhYSDgoGAf359fHt6eXl4eHd3d3d3d3d4eHl5enp7fH1+f4CAgYKDhIWGh4iJiouLjI2Njo6Oj4+Pj4+Pj4+OjY2MjIuKiYiHhoWEg4KBgH9+fXx7enp5eXh4d3d3d3d4eHl5enp7e3x9fn+AgIGCg4SFhoaHiImKiouMjIyNjY2Njo6Ojo2NjY2MjIuKiYmIh4aFhIOCgYCAf359fHt6enl5eHh3d3d4eHl5enp7e3x9fn9/gIGCg4SEhYaHiImKiouLjIyMjY2NjY2NjY2NjIyMi4uKiYiIh4aFhIOCgYB/fn18e3p6eXl4eHh4eHh5eXp6e3t8fH1+f3+AgYGCg4SEhYaHiImJiouLi4yMjIyMjIyMjIyLi4uKiomIiIeGhYSEg4KBgH9+fXx7e3p5eXl4eHh4eXl5ent7fHx9fn5/gIGBgoODhIWGhoeIiYmKiouLi4uLi4yMjIyLi4uKiomJiIeGhoWEg4KBgIB/fn18e3t6eXl5eXl5eXl6enp7e3x8fX5+f4CAgYGCg4OEhYWGh4eIiYmKioqKi4uLi4uLi4qKiomJiIeHhoWEg4OCgYCAf359fHx7enp5eXl5eXl5enp7e3x8fH1+fn9/gICBgoKDhISFhYaHh4iIiYmKioqKioqKioqKiYmIiIeHhoWFhIOCgoCAfn59fHt7e3p6enl5eXp6ent7fHx8fX1+fn9/gICBgYKCg4SEhYWGhoeHiIiJiYmJiYmJiYmJiYiIh4eGhoWEg4OCgYGAf359fHx7e3p6enp6enp6e3t7fHx8fX1+fn9/gICAgYGCgoODhIWFhYaGh4eHiIiIiIiIiIiIiIeHhoaFhYSEg4KBgYB/fn18fHt7e3p6enp6enp6e3t8fHx9fX5+fn9/gICAgYGCgoODhISEhYWFhoaGh4eHh4eHh4eGhoaFhYSEg4KCgYCAf359fHx7e3t6e3p6e3t7e3t8fHx8fX1+fn5/f4CAgIGBgYKCg4ODhISEhYWFhYaGhoaGhoaGhYWFhISEg4OCgoGBgH9/fn18fHt7e3t7e3t7e3t7e3x8fHx9fX1+fn5/f3+AgICBgYGCgoKDg4OEhISEhYWFhYWFhYWFhYWEhISEg4ODgoKBgYB/f359fHx8e3t7e3t7e3t7e3t8fHx8fX19fn5+f39/gICAgIGBgYKCgoODg4OEhISEhISEhISEhISEhIODg4KCgoGBgIB/f359fHx8fHt7e3t7e3t7e3x8fHx8fX1+fn5+f3+AgICAgYGBgYKCgoKDg4ODhISEhISEhISEg4ODg4ODgoKCgYGAf39+fn18fHx8e3t7e3t7fHx8fHx8fH19fX5+fn9/f3+AgICAgYGBgYKCgoKCg4ODg4ODg4ODg4ODg4OCgoKCgYGAgH9/fn59fXx8fHx8fHx8fHx8fHx8fHx9fX1+fn5+f39/f4CAgICAgYGBgYGCgoKCgoKCg4ODg4OCgoKCgoGBgYCAf39+fn19fXx8fHx8fHx8fHx8fHx8fX19fX5+fn5/f39/gICAgIGBgYGBgYGCgoKCgoKCgoKCgoKCgoKBgYGBgIB/f35+fX19fXx8fHx8fHx8fHx8fH19fX19fn5+fn9/f3+AgICAgICAgYGBgYGBgYKCgoKCgoKCgoKCgYGBgYCAf39/fn5+fX19fXx8fHx8fHx8fHx8fX19fX1+fn5+fn9/f3+AgICAgICBgYGBgYGBgYGBgYGBgYGBgYGBgYCAf39/fn5+fX19fX19fHx8fHx9fX19fX19fX5+fn5/f39/f4CAgICAgIGBgYGBgYGBgYGBgYGBgYGBgYGAgIB/f39+fn5+fX19fX19fX19fX19fX19fX5+fn5+f39/f3+AgICAgICAgYGBgYGBgYGBgYGBgYGBgICAgIB/f39/fn5+fn19fX19fX19fX19fX19fn5+fn5+f39/f39/gICAgICAf35+fX18fHx8fXx9fX19fX1+fn5+fn9/f4CAgICAgYGBgYGBgYGBgYGBgYGA";

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
  const [hasConfettiFired, setHasConfettiFired] = useState(false);

  const currentStepData = tutorialSteps[currentStep];
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

  const playCelebration = useCallback(() => {
    playSound(CELEBRATION_SOUND, 0.4);
  }, [playSound]);

  // Play whoosh sound on step transitions
  useEffect(() => {
    if (isTutorialActive && currentStep > 0) {
      playWhoosh();
    }
  }, [currentStep, isTutorialActive, playWhoosh]);

  // Confetti celebration function
  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confetti from left side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'],
      });

      // Confetti from right side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'],
      });
    }, 250);

    // Initial burst from center
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'],
      zIndex: 200,
    });
  }, []);

  // Trigger confetti on last step (no sound)
  useEffect(() => {
    if (isTutorialActive && isLastStep && !hasConfettiFired) {
      setHasConfettiFired(true);
      fireConfetti();
    }
    
    // Reset confetti flag when tutorial restarts
    if (!isTutorialActive) {
      setHasConfettiFired(false);
    }
  }, [isTutorialActive, isLastStep, hasConfettiFired, fireConfetti]);

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
                <div className="animate-scale-in flex flex-col items-center">
                  <TutorialTooltip
                    title={currentStepData.title}
                    description={currentStepData.description}
                    icon={currentStepData.icon}
                    position="center"
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onNext={nextStep}
                    onSkip={skipTutorial}
                    isLastStep={isLastStep}
                  />
                  {/* Show Demo Request Card */}
                  {currentStepData.showDemoRequest && <DemoRequestCard />}
                  {/* Show Important Info Box */}
                  {currentStepData.showInfoBox && <ImportantInfoBox />}
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
                  isLastStep={isLastStep}
                />
              </div>
            ) : null}
      </div>
    </>
  );
};