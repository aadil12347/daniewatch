import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A boolean flag setter that guarantees the flag stays `true` for at least `minMs`.
 * Useful for "load more" / infinite scroll spinners to avoid flicker.
 */
export function useMinDurationLoading(minMs: number) {
  const [isLoading, _setIsLoading] = useState(false);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const setIsLoading = useCallback(
    (next: boolean) => {
      if (next) {
        clearTimer();
        startedAtRef.current = Date.now();
        _setIsLoading(true);
        return;
      }

      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, minMs - elapsed);
      if (remaining === 0) {
        clearTimer();
        _setIsLoading(false);
        return;
      }

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        _setIsLoading(false);
        timerRef.current = null;
      }, remaining);
    },
    [minMs]
  );

  useEffect(() => {
    return () => clearTimer();
  }, []);

  return [isLoading, setIsLoading] as const;
}
