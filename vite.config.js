import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "DML Time Clock",
        short_name: "Time Clock",
        description: "DML Electrical Service LLC Time Clock",
        theme_color: "#0b3ea8",
        background_color: "#0b1220",
        display: "standalone",
        scope: "/",
        start_url: "/timeclock?mobile=1",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 5000000,
      },
    }),
  ],
});



