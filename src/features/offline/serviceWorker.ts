/**
 * Sprint 4B — the ONLY place that registers a service worker.
 *
 * Registration is refused in dev, inside iframes and in every Lovable preview
 * host, and `?sw=off` unregisters the app worker. Messaging workers (none
 * today) are never touched.
 */

const SW_URL = "/sw.js";

const previewHost = (hostname: string) =>
  hostname.startsWith("id-preview--") ||
  hostname.startsWith("preview--") ||
  hostname === "lovableproject.com" ||
  hostname.endsWith(".lovableproject.com") ||
  hostname === "lovableproject-dev.com" ||
  hostname.endsWith(".lovableproject-dev.com") ||
  hostname === "beta.lovable.dev" ||
  hostname.endsWith(".beta.lovable.dev");

function refused(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  if (previewHost(window.location.hostname)) return true;
  return new URLSearchParams(window.location.search).get("sw") === "off";
}

async function unregisterAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const url = registration.active?.scriptURL ?? registration.installing?.scriptURL ?? "";
        return url.endsWith(SW_URL);
      })
      .map((registration) => registration.unregister()),
  );
}

/** True when the SW that serves `/__offline-resources/` controls this page. */
export function offlineRouteAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    Boolean(navigator.serviceWorker.controller)
  );
}

export async function registerOfflineServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) {
    await unregisterAppWorker().catch(() => undefined);
    return;
  }
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (error) {
    console.warn("[offline] service worker registration failed", error);
  }
}
