export function registerSW() {
  // VitePWA injects the actual SW registration code through the virtual module.
  // Keeping this in a separate file lets us control initialization order.
  if (import.meta.env.DEV) return;

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        // Show non-intrusive toast or simple log
        console.log("[PWA] New content available, click reload button to update.");
        // We can expose this info to UI via a store or event if needed, but for now 
        // we ensure the SW waits for user action or next visit unless we force it.
        // User requested: "simple browser refresh is enough" -> this means skipWaiting/clientsClaim in SW.
        // We assume the SW is configured with skipWaiting: true in vite config or sw code.
      },
      onRegistered(r) {
        // Immediate claim logic implies calling update() if stuck? 
        // Or simply ensuring interval checks.
        r && setInterval(() => {
          r.update();
        }, 60 * 60 * 1000); // Check every hour
      },
    });
  });
}
