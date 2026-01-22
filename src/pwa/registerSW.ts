export function registerSW() {
  // VitePWA injects the actual SW registration code through the virtual module.
  // Keeping this in a separate file lets us control initialization order.
  if (import.meta.env.DEV) return;

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegistered() {
        // no-op (kept for future diagnostics)
      },
    });
  });
}
