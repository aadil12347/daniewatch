import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type NavTransitionContextValue = {
  isNavigating: boolean;
  startNavigation: (label?: string) => void;
  stopNavigation: () => void;
  label?: string;
};

const NavTransitionContext = createContext<NavTransitionContextValue | null>(null);

export const NavTransitionProvider = ({ children }: { children: React.ReactNode }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [label, setLabel] = useState<string | undefined>(undefined);

  const startNavigation = useCallback((nextLabel?: string) => {
    setLabel(nextLabel);
    setIsNavigating(true);
  }, []);

  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setLabel(undefined);
  }, []);

  const value = useMemo(
    () => ({ isNavigating, startNavigation, stopNavigation, label }),
    [isNavigating, startNavigation, stopNavigation, label]
  );

  return <NavTransitionContext.Provider value={value}>{children}</NavTransitionContext.Provider>;
};

export const useNavTransition = () => {
  const ctx = useContext(NavTransitionContext);
  if (!ctx) throw new Error("useNavTransition must be used within NavTransitionProvider");
  return ctx;
};
