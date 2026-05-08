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
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // PWA — installable + offline-capable on the published domain.
    // Disabled in dev so the SW never interferes with HMR / Lovable preview.
    // Registration in src/main.tsx is also iframe + preview-host guarded.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // we register manually in main.tsx with guards
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.png",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
      ],
      manifest: false, // keep our hand-written /manifest.webmanifest
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false, // wait for next visit so we don't yank in-flight SSE
        // Don't try to cache OAuth callback / Supabase function endpoints.
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/api\//,
          /^\/auth\//,
          /^\/functions\//,
        ],
        // Vendor chunks (monaco, sandpack) can be huge — bump the limit so
        // they get precached on first visit and instant-serve afterwards.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // HTML navigations: always try network first (3s), fall back to cache.
            // Prevents stale-shell lock-in across deploys.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Google Fonts CSS — short cache, refresh frequently.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            // Google Fonts files — long cache.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // App images & icons.
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-images",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Supabase REST / functions — NEVER cache. Always go to network.
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Split vendor code into stable chunks so a small app change doesn't
    // invalidate the giant editor/UI bundle on every deploy. Massive perf
    // win for large projects (initial load + cache reuse).
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          if (id.includes("@monaco-editor") || id.includes("monaco-editor")) return "monaco";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("react-dom") || id.includes("react/") || id.includes("scheduler")) return "react";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("jszip") || id.includes("qrcode")) return "export-tools";
          // Heavy single-feature deps — isolated so they only download
          // when the feature is actually used (lazy imports below).
          if (id.includes("jspdf")) return "jspdf";
          if (id.includes("html2canvas")) return "html2canvas";
          if (id.includes("pdfjs-dist")) return "pdfjs";
          if (id.includes("mammoth")) return "mammoth";
          if (id.includes("canvas-confetti")) return "confetti";
          if (id.includes("react-syntax-highlighter") || id.includes("refractor") || id.includes("prismjs")) return "syntax-highlighter";
          if (id.includes("@codesandbox/sandpack")) return "sandpack";
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
}));
