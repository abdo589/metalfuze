// @lovable.dev/vite-tanstack-config already includes the core plugins — do NOT add them manually.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      mcpPlugin(),
      // Offline support: registered only by src/lib/pwa-register.ts (never in dev/preview).
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: false,
        filename: "sw.js",
        devOptions: { enabled: false },
        workbox: {
          globPatterns: ["**/*.{js,css,woff2,png,svg,ico}"],
          navigateFallback: null,
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth") && !url.pathname.startsWith("/api/"),
              handler: "NetworkFirst",
              options: { cacheName: "pages", networkTimeoutSeconds: 4 },
            },
            {
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: { cacheName: "assets", expiration: { maxEntries: 300 } },
            },
          ],
        },
      }),
    ],
  },
});
