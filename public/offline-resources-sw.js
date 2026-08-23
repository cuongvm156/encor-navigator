/* eslint-disable no-undef */
/**
 * Sprint 4B — offline resource responder, imported by the generated Workbox
 * service worker (see vite.config.ts `workbox.importScripts`).
 *
 * It only answers same-origin GET requests under /__offline-resources/ and
 * serves the binary stored in the `encor-offline-resources-v1` cache, with
 * HTTP Range support so iOS Safari can seek audio. It never deletes caches and
 * never touches any other request.
 */

const OFFLINE_CACHE_NAME = "encor-offline-resources-v1";
const OFFLINE_URL_PREFIX = "/__offline-resources/";

/** Full 200 response with explicit length/type headers (never a navigation fallback). */
async function fullResponse(cached) {
  const buffer = await cached.arrayBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": cached.headers.get("Content-Type") || "application/octet-stream",
      "Content-Length": String(buffer.byteLength),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
}

async function respondWithOfflineResource(request) {
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const cached = await cache.match(new URL(request.url).pathname);
  if (!cached) {
    return new Response("Offline resource not stored on this device.", {
      status: 404,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) return fullResponse(cached);

  const buffer = await cached.arrayBuffer();
  const total = buffer.byteLength;
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) return fullResponse(cached);

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }

  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": cached.headers.get("Content-Type") || "application/octet-stream",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(OFFLINE_URL_PREFIX)) return;
  event.respondWith(respondWithOfflineResource(request));
});
