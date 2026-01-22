import React from "react";
import { useEffect } from "react";

const BC_NAME = "dw-sw";

/**
 * Listens for SW cache updates and forwards them into the running app
 * without requiring a full reload.
 */
export function useServiceWorkerSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (typeof BroadcastChannel === "undefined") return;

    const bc = new BroadcastChannel(BC_NAME);
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      // Forward as a window event so any page can subscribe without tight coupling.
      window.dispatchEvent(new CustomEvent("sw:message", { detail: data }));
    };
    bc.addEventListener("message", onMessage);
    return () => {
      bc.removeEventListener("message", onMessage);
      bc.close();
    };
  }, [enabled]);
}
