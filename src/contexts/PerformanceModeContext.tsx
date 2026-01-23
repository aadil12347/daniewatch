import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type PerformanceMode = "quality" | "performance";

export type LastModeSwitch = {
  mode: PerformanceMode;
  at: number;
};

export type PerformanceModeContextValue = {
  mode: PerformanceMode;
  setMode: (next: PerformanceMode) => void;
  isPerformance: boolean;
  lastSwitch: LastModeSwitch | null;
};

const PerformanceModeContext = createContext<PerformanceModeContextValue | null>(null);

const GUEST_KEY = "render_mode_guest_v1";
const userKey = (userId: string) => `render_mode_user_${userId}_v1`;

const PREFS_TABLE = "user_preferences";

const normalizeMode = (value: unknown): PerformanceMode | null => {
  return value === "quality" || value === "performance" ? value : null;
};

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

const detectGuestDefaultMode = (): PerformanceMode => {
  // Requested behavior: Quality is the default mode.
  return "quality";
};

const isProbablyMobile = (): boolean => {
  // Lightweight heuristic (no hooks) to distinguish mobile vs desktop.
  // Used only for first-time default selection for logged-in users.
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    // "coarse" pointer catches most touch devices; width fallback for small screens.
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(max-width: 768px)").matches
    );
  } catch {
    return false;
  }
};

const detectLoggedInDeviceDefaultMode = (): PerformanceMode => {
  // Requested behavior: when user logs in, default is Performance on mobile, Quality on desktop.
  return isProbablyMobile() ? "performance" : "quality";
};

const loadDbMode = async (userId: string): Promise<PerformanceMode | null> => {
  try {
    const { data, error } = await supabase
      .from(PREFS_TABLE)
      .select("performance_mode")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return null;
    return normalizeMode((data as any)?.performance_mode);
  } catch {
    return null;
  }
};

const saveDbMode = async (userId: string, mode: PerformanceMode): Promise<void> => {
  try {
    await supabase
      .from(PREFS_TABLE)
      .upsert({ user_id: userId, performance_mode: mode }, { onConflict: "user_id" });
  } catch {
    // ignore (do not block UI)
  }
};

export function PerformanceModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [mode, setModeState] = useState<PerformanceMode>("quality");
  const [lastSwitch, setLastSwitch] = useState<LastModeSwitch | null>(null);

  // Hydrate on mount and when user changes (per-user persistence)
  useEffect(() => {
    let cancelled = false;

    // Logged out => keep existing localStorage + detection behavior.
    if (!user?.id) {
      const stored = normalizeMode(safeRead(GUEST_KEY));
      const next = stored ?? detectGuestDefaultMode();
      setModeState(next);
      safeWrite(GUEST_KEY, next);
      return () => {
        cancelled = true;
      };
    }

    const uid = user.id;

    // Compute a local fallback (used if DB read fails OR for first-time seed)
    const storedUser = normalizeMode(safeRead(userKey(uid)));
    const storedGuest = normalizeMode(safeRead(GUEST_KEY));
    const fallbackMode = storedUser ?? storedGuest ?? detectLoggedInDeviceDefaultMode();

    (async () => {
      const dbMode = await loadDbMode(uid);

      if (cancelled) return;

      if (dbMode) {
        setModeState(dbMode);
        // keep local device cache aligned (helpful before auth hydrates)
        safeWrite(userKey(uid), dbMode);
        safeWrite(GUEST_KEY, dbMode);
        return;
      }

      // No DB row (or DB error) => use fallback and try seeding.
      setModeState(fallbackMode);
      safeWrite(userKey(uid), fallbackMode);
      safeWrite(GUEST_KEY, fallbackMode);
      // Best-effort seed; DB is source of truth once it exists.
      await saveDbMode(uid, fallbackMode);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Apply root class hook for CSS
  useEffect(() => {
    document.documentElement.classList.toggle("perf-mode", mode === "performance");
    document.documentElement.classList.toggle("quality-mode", mode === "quality");
  }, [mode]);

  const setMode = (next: PerformanceMode) => {
    if (next === mode) return;

    setModeState(next);
    setLastSwitch({ mode: next, at: Date.now() });
    // Always store on device so the same device remembers a default even before login
    safeWrite(GUEST_KEY, next);
    if (user?.id) {
      safeWrite(userKey(user.id), next);
      void saveDbMode(user.id, next);
    }
  };

  const value = useMemo<PerformanceModeContextValue>(
    () => ({
      mode,
      setMode,
      isPerformance: mode === "performance",
      lastSwitch,
    }),
    [mode, lastSwitch]
  );

  return <PerformanceModeContext.Provider value={value}>{children}</PerformanceModeContext.Provider>;
}

export function usePerformanceMode(): PerformanceModeContextValue {
  const ctx = useContext(PerformanceModeContext);
  if (!ctx) throw new Error("usePerformanceMode must be used within PerformanceModeProvider");
  return ctx;
}
