import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      // We need custom SW logic (priority caching + runtime caching rules)
      strategies: "injectManifest",
      srcDir: "src/pwa",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: null,
      manifest: {
        name: "DanieWatch",
        short_name: "DanieWatch",
        start_url: "/",
        display: "standalone",
        background_color: "#0a0a0a",
        theme_color: "#e11d48",
        icons: [
          { src: "/logo-192.png", sizes: "192x192", type: "image/png" },
          { src: "/logo-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      includeAssets: [
        "favicon.ico",
        "favicon.png",
        "logo-192.png",
        "logo-512.png",
        "logo.svg",
        "robots.txt",
        "placeholder.svg",
      ],
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
