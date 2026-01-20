import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type PerformanceMode = "quality" | "performance";

type PerformanceModeContextValue = {
  mode: PerformanceMode;
  setMode: (next: PerformanceMode) => void;
  isPerformance: boolean;
};

const PerformanceModeContext = createContext<PerformanceModeContextValue | null>(null);

const GUEST_KEY = "render_mode_guest_v1";
const userKey = (userId: string) => `render_mode_user_${userId}_v1`;

const safeRead = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWrite = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const detectDefaultMode = (): PerformanceMode => {
  // Primary: deviceMemory threshold requested by user
  const mem = (navigator as any).deviceMemory as number | undefined;
  if (typeof mem === "number") {
    return mem <= 6 ? "performance" : "quality";
  }

  // Fallback signals (safe + conservative)
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return "performance";

  const connection = (navigator as any).connection as
    | { saveData?: boolean; effectiveType?: string }
    | undefined;
  if (connection?.saveData) return "performance";
  if (connection?.effectiveType && ["slow-2g", "2g"].includes(connection.effectiveType)) {
    return "performance";
  }

  return "quality";
};

export function PerformanceModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [mode, setModeState] = useState<PerformanceMode>("quality");

  // Hydrate on mount and when user changes (per-user persistence)
  useEffect(() => {
    const key = user?.id ? userKey(user.id) : GUEST_KEY;
    const stored = safeRead(key);
    const normalized = stored === "performance" || stored === "quality" ? stored : null;

    if (normalized) {
      setModeState(normalized);
      return;
    }

    // If logged in and no user key, try inheriting guest choice.
    if (user?.id) {
      const guest = safeRead(GUEST_KEY);
      const guestNorm = guest === "performance" || guest === "quality" ? guest : null;
      if (guestNorm) {
        setModeState(guestNorm);
        safeWrite(key, guestNorm);
        return;
      }
    }

    const detected = detectDefaultMode();
    setModeState(detected);
    safeWrite(key, detected);
  }, [user?.id]);

  // Apply root class hook for CSS
  useEffect(() => {
    document.documentElement.classList.toggle("perf-mode", mode === "performance");
    document.documentElement.classList.toggle("quality-mode", mode === "quality");
  }, [mode]);

  const setMode = (next: PerformanceMode) => {
    setModeState(next);
    if (user?.id) safeWrite(userKey(user.id), next);
    // Also store on device so the same device remembers a default even before login
    safeWrite(GUEST_KEY, next);
  };

  const value = useMemo<PerformanceModeContextValue>(
    () => ({
      mode,
      setMode,
      isPerformance: mode === "performance",
    }),
    [mode]
  );

  return <PerformanceModeContext.Provider value={value}>{children}</PerformanceModeContext.Provider>;
}

export function usePerformanceMode() {
  const ctx = useContext(PerformanceModeContext);
  if (!ctx) throw new Error("usePerformanceMode must be used within PerformanceModeProvider");
  return ctx;
}
