import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type PerformanceMode = "quality" | "performance";

type PerformanceModeContextValue = {
  mode: PerformanceMode;
  setMode: (next: PerformanceMode) => void;
  isPerformance: boolean;
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

  // Hydrate on mount and when user changes (per-user persistence)
  useEffect(() => {
    let cancelled = false;

    // Logged out => keep existing localStorage + detection behavior.
    if (!user?.id) {
      const stored = normalizeMode(safeRead(GUEST_KEY));
      const next = stored ?? detectDefaultMode();
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
    const fallbackMode = storedUser ?? storedGuest ?? detectDefaultMode();

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
    setModeState(next);
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
