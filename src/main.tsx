import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { registerSW } from "virtual:pwa-register";
import { requestPersistentStorage } from "@/lib/persistentStorage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register the Service Worker (PWA) with silent background updates.
registerSW({
  immediate: true,
  onRegistered() {
    // Best-effort: ask browser to persist caches (helps on low storage devices).
    void requestPersistentStorage();
  },
});
