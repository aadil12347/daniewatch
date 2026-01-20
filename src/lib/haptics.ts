export type HapticPattern = "tap" | "confirm" | "success" | "error";

const patterns: Record<HapticPattern, number | number[]> = {
  tap: 10,
  confirm: 18,
  success: [10, 45, 10],
  error: [22, 40, 22],
};

export const canVibrate = () => {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
};

export const haptic = (pattern: HapticPattern = "tap") => {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(patterns[pattern]);
  } catch {
    // ignore
  }
};
