import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface TutorialContextType {
  isTutorialActive: boolean;
  currentStep: number;
  totalSteps: number;
  nextStep: () => void;
  skipTutorial: () => void;
  startTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const TUTORIAL_FLAG_KEY = "daniewatch_show_tutorial";

export const TutorialProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 6; // Welcome, Navigation, Search, Request, My Requests, Celebration

  useEffect(() => {
    // Only show tutorial if:
    // 1. User is authenticated
    // 2. The tutorial flag exists in localStorage (set during signup)
    if (user) {
      const shouldShowTutorial = localStorage.getItem(TUTORIAL_FLAG_KEY) === "true";
      if (shouldShowTutorial) {
        // Small delay to let the page load first
        const timer = setTimeout(() => {
          setIsTutorialActive(true);
          setCurrentStep(0);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      completeTutorial();
    }
  };

  const skipTutorial = () => {
    completeTutorial();
  };

  const completeTutorial = () => {
    setIsTutorialActive(false);
    setCurrentStep(0);
    localStorage.removeItem(TUTORIAL_FLAG_KEY);
  };

  const startTutorial = () => {
    setIsTutorialActive(true);
    setCurrentStep(0);
  };

  return (
    <TutorialContext.Provider
      value={{
        isTutorialActive,
        currentStep,
        totalSteps,
        nextStep,
        skipTutorial,
        startTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
};

// Helper to set the tutorial flag on signup
export const setTutorialFlag = () => {
  localStorage.setItem(TUTORIAL_FLAG_KEY, "true");
};
