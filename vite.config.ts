import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // FIX: This ensures assets load correctly in preview iframes/subpaths
  base: "./",

  server: {
    host: true,
    port: 8080,
    proxy: {
      "/api/vegamovies": {
        target: "https://vegamovies.gallery",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/vegamovies/, ""),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36",
          Referer: "https://vegamovies.gallery/",
        },
      },
      "/api/rogmovies": {
        target: "https://rogmovies.best",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/rogmovies/, ""),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36",
          Referer: "https://rogmovies.best/",
        },
      },
    },
  },

  plugins: [
    {
      name: "cors-proxy-plugin",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith("/api/proxy?url=")) {
            const rawUrl = req.url.slice("/api/proxy?url=".length);
            const targetUrl = decodeURIComponent(rawUrl);
            try {
              const fetchRes = await fetch(targetUrl, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36",
                  Referer: new URL(targetUrl).origin + "/",
                },
              });
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.setHeader(
                "Content-Type",
                fetchRes.headers.get("content-type") || "text/html; charset=utf-8"
              );
              const body = await fetchRes.text();
              res.end(body);
              return;
            } catch (e: any) {
              res.statusCode = 500;
              res.end(e?.message || "Proxy Error");
              return;
            }
          }
          next();
        });
      },
    },
    react(),
    VitePWA({
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
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
