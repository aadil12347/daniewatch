import { useEffect, useState, useCallback } from "react";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialTooltip } from "./TutorialTooltip";
import { cn } from "@/lib/utils";
import { Home, Search, MessageSquarePlus, FileText, Sparkles, PartyPopper, Check, Info, MousePointer2, Send } from "lucide-react";
import confetti from "canvas-confetti";

// Base64 encoded sound effects (short, subtle sounds)
const WHOOSH_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdnd3eXd3dnl6enp4eHd1dHNycnFxcXFxcXFyc3R1d3h5enp6e3t6enp5eHd2dXRzcnFxcHBwcHBwcXFycnR1dnh5e3x9fn5+fn59fHt6eXh3dnV0c3JxcHBvb29vb29wcHFyc3R2d3l6fH1+f4CAgICAf39+fXx7enl4d3Z1dHNycXBwb29vb29vb3BwcXJzdHV3eHp7fH1+f4CAgICAgIB/f359fHt6eXh3dnV0c3JxcHBvb29vb29vb3BwcXJzdHV2eHl6e3x9fn9/gICAf39/fn59fHt6eXh3dnV0c3JxcXBwb29vbm5ub29vcHBxcnN0dXZ3eXp7fH1+fn9/f39/fn5+fXx7enl4d3Z1dHNycnFwcG9vb29vbm5ub29vcHBxcnN0dXZ3eHl6e3x9fX5+fn5+fn19fHt6eXh3dnZ1dHNycXFwb29vbm5ubm5ub29vcHBxcnN0dXZ3eHl6e3t8fX19fX19fX18e3p5eHd2dXR0c3JxcXBvb29ubm5ubm5ub29vcHBxcnN0dXZ2d3h5ent7fHx8fX19fHx7enl4d3Z1dHNzc3JxcHBvb29ubm5ubm5ub29vcHBxcnN0dXZ2d3h5ent7fHx8fHx8e3t6eXh3dnV0dHNycnFwcG9vbm5ubm5ubm5ub29vcHBxcnN0dXV2d3h5enp7e3t7e3t7e3p5eHd2dXR0c3NycXFwb29vbm5ubm5ubm5ub29vcHBxcnN0dXV2d3d4eXl6enp6enp6eXl4d3Z1dHRzc3JxcHBvb29ubm5ubm5ubm5vb29wcHFyc3R0dXZ2d3d4eXl5eXl5eXl4eHd2dXR0c3NycXFwb29vbm5ubm5ubm5ub29vcHBxcnN0dHV1dnd3eHh4eHh4eHh3d3Z1dHRzc3JycXBwb29vbm5ubm5ubm5ub29vcHBxcnJzc3R1dXZ2d3d3d3d3d3d2dnV0dHNzc3JxcXBvb29ubm5ubm5ubm5ub29vcHBxcXJyc3R0dXV2dnZ2dnZ2dnV1dHRzc3JycXFwcG9vb29ubm5ubm5ubm5ub29vcHBwcXFycnJzc3R0dHR0dHR0c3NzcnJxcXBwb29vb25ubm5ubm5ubm5ub29vcHBwcXFxcnJyc3Nzc3Nzc3Nzc3NycnFxcXBwb29vb25ubm5ubm5ubm5ub29vcHBwcHFxcXJycnJycnJycnJycnJycXFwcHBvb29vbm5ubm5ubm5ubm5ub29vcHBwcHFxcXFxcXJycnJycnJxcXFwcHBvb29vb25ubm5ubm5ubm5ub29vcHBwcHBwcXFxcXFxcXFxcXFxcHBwb29vb29vbm5ubm5ubm5ubm5ub29vcHBwcHBwcHFxcXFxcXFxcHBwb29vb29vb25ubm5ubm5ubm5ubm5vb29wcHBwcHBwcHBwcXFwcHBwb29vb29vb25ubm5ubm5ubm5ubm5vb29wcHBwcHBwcHBwcHBwcHBvb29vb29ubm5ubm5ubm5ubm5ubm9vb29wcHBwcHBwcHBwcHBvb29vb29vbm5ubm5ubm5ubm5ubm5vb29vb3BwcHBwcHBwcHBvb29vb29vb25ubm5ubm5ubm5ubm5ub29vb29wcHBwcHBwcHBwb29vb29vb29ubm5ubm5ubm5ubm5ubm5vb29vb29wcHBwcHBwcG9vb29vb29vbm5ubm5ubm5ubm5ubm5ub29vb29vb29wcHBwcG9vb29vb29vb25ubm5ubm5ubm5ubm5ubm5vb29vb29vb3Bwb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5vb29vb29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb29vbm5ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5ubm5vb29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ubm9vb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5ubm5vb29vb29vb29vb29vb29vbm5ubm5ubm5ubm5ubm5ubm5ub29vb29vb29vb29vb29vb25ubm5ubm5ubm5ubm5ubm5ubm9vb29vb29vb29vb29vb25ubm5ubm5u";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string | null;
  position: "top" | "bottom" | "left" | "right" | "center";
  icon: React.ReactNode;
  showDemoRequest?: boolean;
  showInfoBox?: boolean;
  showAnimatedDemo?: boolean;
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
    description: "Dekhiye kaise request karte hain...",
    targetSelector: null,
    position: "center",
    icon: <MessageSquarePlus className="w-5 h-5" />,
    showAnimatedDemo: true,
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

// Animated Request Demo Component
const AnimatedRequestDemo = ({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) => {
  const [phase, setPhase] = useState(0);
  const [typedText, setTypedText] = useState("");
  const targetText = "Hindi main upload kar dain with download link";
  
  useEffect(() => {
    // Phase 0: Show request button with cursor moving to it (0-2s)
    // Phase 1: Click animation on button (2-2.5s)
    // Phase 2: Form opens, start typing (2.5-6s)
    // Phase 3: Click submit (6-7s)
    // Phase 4: Complete - trigger next step (7s+)
    
    const timers: ReturnType<typeof setTimeout>[] = [];
    let typeInterval: ReturnType<typeof setInterval> | null = null;
    
    // Phase 1: Click button
    timers.push(setTimeout(() => setPhase(1), 1500));
    
    // Phase 2: Show form
    timers.push(setTimeout(() => setPhase(2), 2200));
    
    // Phase 3: Start typing
    let charIndex = 0;
    timers.push(setTimeout(() => {
      typeInterval = setInterval(() => {
        if (charIndex < targetText.length) {
          setTypedText(targetText.slice(0, charIndex + 1));
          charIndex++;
        } else {
          if (typeInterval) clearInterval(typeInterval);
        }
      }, 60);
    }, 2500));
    
    // Phase 4: Click submit
    timers.push(setTimeout(() => setPhase(3), 5500));
    
    // Phase 5: Complete
    timers.push(setTimeout(() => {
      setPhase(4);
      onComplete();
    }, 6500));
    
    return () => {
      timers.forEach(t => clearTimeout(t));
      if (typeInterval) clearInterval(typeInterval);
    };
  }, []); // Empty deps - only run once on mount
  
  return (
    <div className="relative w-full max-w-md mx-auto mt-6">
      {/* Demo Label */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
        <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/30">
          LIVE DEMO
        </span>
      </div>
      
      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute -top-3 right-0 text-xs text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        Skip Tutorial →
      </button>
      
      <div className="bg-card/90 backdrop-blur-xl rounded-2xl p-6 border border-border/50 shadow-2xl">
        {phase < 2 ? (
          // Show request button with cursor
          <div className="flex flex-col items-center justify-center py-8 relative">
            <div className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all duration-300",
              phase === 1 && "scale-95 brightness-90"
            )}>
              <MessageSquarePlus className="w-5 h-5" />
              <span>Request Movie/Show</span>
            </div>
            
            {/* Animated Cursor */}
            <div className={cn(
              "absolute transition-all duration-1000 ease-out",
              phase === 0 && "bottom-0 right-0",
              phase >= 1 && "bottom-1/2 right-1/2 translate-x-8 translate-y-4"
            )}>
              <div className="relative">
                <MousePointer2 className="w-6 h-6 text-foreground fill-foreground" />
                {phase === 1 && (
                  <div className="absolute -top-1 -left-1 w-8 h-8 bg-primary/30 rounded-full animate-ping" />
                )}
              </div>
              <span className="absolute -bottom-6 left-0 text-xs text-primary whitespace-nowrap animate-pulse">
                Yaha click karain!
              </span>
            </div>
          </div>
        ) : phase < 4 ? (
          // Show form being filled
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-primary" />
              Request Content
            </h3>
            
            {/* Movie Title Field */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Movie/Show Title</label>
              <div className="px-4 py-3 rounded-lg bg-secondary/50 border border-border text-foreground">
                Inception (2010)
              </div>
            </div>
            
            {/* Message Field with typing animation */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Your Message</label>
              <div className="px-4 py-3 rounded-lg bg-secondary/50 border border-border text-foreground min-h-[80px] relative">
                {typedText}
                <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-0.5" />
              </div>
            </div>
            
            {/* Submit Button */}
            <div className="relative">
              <button className={cn(
                "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all duration-300",
                phase === 3 && "scale-95 brightness-90"
              )}>
                <Send className="w-4 h-4" />
                Submit Request
              </button>
              
              {/* Cursor on submit button */}
              {phase === 3 && (
                <div className="absolute bottom-1/2 right-1/4 translate-y-2">
                  <MousePointer2 className="w-6 h-6 text-foreground fill-foreground" />
                  <div className="absolute -top-1 -left-1 w-8 h-8 bg-primary/30 rounded-full animate-ping" />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Demo Request Card Component
const DemoRequestCard = () => {
  return (
    <div className="w-full max-w-md mx-auto mt-6">
      {/* Page indicator */}
      <div className="flex items-center justify-center gap-2 mb-4 text-sm text-muted-foreground">
        <FileText className="w-4 h-4" />
        <span>My Requests Page</span>
      </div>
      
      <div className="bg-card/90 backdrop-blur-xl rounded-2xl p-4 border border-border/50 shadow-xl animate-scale-in">
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
          "Hindi main upload kar dain with download link"
        </p>
        
        {/* Admin Response */}
        <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
          <p className="text-xs text-primary font-medium mb-1">Admin Response:</p>
          <p className="text-sm text-foreground">
            Movie upload ho gaya hai! Ab aap dekh sakte ho. Enjoy karo! 🎬
          </p>
        </div>
        
        {/* Arrow indicator */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-primary">
          <Info className="w-3 h-3" />
          <span>Aap ki request yaha dikhegi!</span>
        </div>
      </div>
    </div>
  );
};

// Important Info Box Component (Now the main content for last step)
const ImportantInfoBox = () => (
  <div className="w-full max-w-md mx-auto mt-2">
    <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/30 shadow-xl">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Info className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h4 className="font-bold text-primary text-lg mb-2">Yaad Rakhein!</h4>
          <p className="text-foreground/90 leading-relaxed">
            Agar kisi movie ya season ka download link nahi available hai, 
            to admin ko request kar saktay hain aur wo add kar day ga! 🎬
          </p>
        </div>
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <p className="text-sm text-muted-foreground">
          Happy Streaming! 🍿
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
  const [demoComplete, setDemoComplete] = useState(false);

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

  // Play whoosh sound on step transitions
  useEffect(() => {
    if (isTutorialActive && currentStep > 0) {
      playWhoosh();
    }
  }, [currentStep, isTutorialActive, playWhoosh]);

  // Reset demo complete state when step changes
  useEffect(() => {
    setDemoComplete(false);
  }, [currentStep]);

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
  
  // Safety check - ensure we have valid step data
  if (!currentStepData) {
    console.error('Tutorial: Invalid step data for step', currentStep);
    return null;
  }

  const isFullscreenStep = !currentStepData.targetSelector;

  // Handle demo completion - auto advance to next step
  const handleDemoComplete = useCallback(() => {
    setDemoComplete(true);
    // Auto advance after a short delay
    setTimeout(() => {
      nextStep();
    }, 500);
  }, [nextStep]);

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
        <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <div className="animate-scale-in flex flex-col items-center w-full max-w-lg py-8">
            {/* Don't show tooltip for animated demo step, just show the demo */}
            {currentStepData.showAnimatedDemo ? (
              <div className="w-full">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3">
                    {currentStepData.icon}
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{currentStepData.title}</h3>
                  <p className="text-muted-foreground mt-1">{currentStepData.description}</p>
                </div>
                <AnimatedRequestDemo onComplete={handleDemoComplete} onSkip={skipTutorial} />
              </div>
            ) : (
              <>
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
                  hideDescription={currentStepData.showInfoBox}
                />
                {/* Show Demo Request Card */}
                {currentStepData.showDemoRequest && <DemoRequestCard />}
                {/* Show Important Info Box (now the main content for last step) */}
                {currentStepData.showInfoBox && <ImportantInfoBox />}
              </>
            )}
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
  );
};
