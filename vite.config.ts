// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { assertResourceManifest } from "./src/data/resourceManifest";

/** Fails the build when the centralized resource manifest is structurally invalid. */
const resourceManifestValidation = {
  name: "encor-resource-manifest-validation",
  buildStart() {
    assertResourceManifest();
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      resourceManifestValidation,
      // Sprint 4B — offline app shell. The generated worker also imports
      // /offline-resources-sw.js, which serves stored chapter binaries from
      // the encor-offline-resources-v1 cache (with Range support for iOS).
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        // Client build output — the worker must be served from the site root.
        outDir: "dist/client",
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          importScripts: ["/offline-resources-sw.js"],
          // `.mjs` matters: PDF.js ships its worker as pdf.worker.min.mjs and it
          // must be precached or offline PDF rendering fails.
          globPatterns: ["**/*.{js,mjs,wasm,css,html,ico,png,svg,webmanifest,woff2}"],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/__offline-resources\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // HTML navigations are never served cache-first.
              urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "encor-pages", networkTimeoutSeconds: 5 },
            },
            {
              urlPattern: ({ request, url }: { request: Request; url: URL }) =>
                url.origin === self.location.origin &&
                ["script", "style", "font", "image", "worker"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: "encor-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});

