export function registerSW() {
  // VitePWA injects the actual SW registration code through the virtual module.
  // Keeping this in a separate file lets us control initialization order.
  if (import.meta.env.DEV) return;

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log("[PWA] New version detected. Auto-updating service worker...");
        // Use window.location.reload() as a fallback if update fails or is void
        window.location.reload();
      },
      onRegistered(r) {
        if (!r) return;
        setInterval(() => {
          r.update();
        }, 10 * 60 * 1000);
      },
    });
  });
}
