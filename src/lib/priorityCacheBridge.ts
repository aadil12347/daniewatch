const PERMANENT_PRIORITY_LIMIT = 10;

export function queuePriorityCache(routeKey: string, urls: string[]) {
  if (typeof window === "undefined") return;
  const controller = navigator.serviceWorker?.controller;
  if (!controller) return;

  const clean = urls.filter(Boolean).slice(0, PERMANENT_PRIORITY_LIMIT);
  if (clean.length === 0) return;

  controller.postMessage({
    type: "CACHE_PRIORITY_ITEMS",
    payload: { routeKey, urls: clean },
  });
}
