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
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.ts",
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.png", "logo-192.png", "logo-512.png", "logo.svg", "manifest.json"],
      manifest: {
        name: "DanieWatch",
        short_name: "DanieWatch",
        description: "Stream movies, TV shows, anime & Korean dramas.",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#ef4444",
        icons: [
          { src: "/logo-192.png", sizes: "192x192", type: "image/png" },
          { src: "/logo-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      devOptions: {
        enabled: mode === "development",
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
