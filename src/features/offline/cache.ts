/**
 * Sprint 4B — Cache Storage layer for offline chapter binaries.
 *
 * Cache Storage is the SOURCE OF TRUTH for binary availability; Dexie only
 * stores searchable metadata. Nothing here ever touches progress, notes or
 * bookmarks, and no cache other than `OFFLINE_CACHE_NAME` is read or deleted.
 */

export const OFFLINE_CACHE_NAME = "encor-offline-resources-v1";
export const OFFLINE_URL_PREFIX = "/__offline-resources/";

export const offlineUrlFor = (resourceId: string) =>
  `${OFFLINE_URL_PREFIX}${encodeURIComponent(resourceId)}`;

export const cacheStorageSupported = () =>
  typeof window !== "undefined" && "caches" in window;

async function openCache(): Promise<Cache | undefined> {
  if (!cacheStorageSupported()) return undefined;
  try {
    return await caches.open(OFFLINE_CACHE_NAME);
  } catch (error) {
    console.warn("[offline] cache unavailable", error);
    return undefined;
  }
}

/** Stores a binary body under the synthetic offline URL. */
export async function putOfflineBinary(
  resourceId: string,
  body: Blob,
  mimeType: string,
): Promise<boolean> {
  const cache = await openCache();
  if (!cache) return false;
  const response = new Response(body, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(body.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
  await cache.put(offlineUrlFor(resourceId), response);
  return true;
}

/** True when a cached binary exists for this resource id. */
export async function hasOfflineBinary(resourceId: string): Promise<boolean> {
  const cache = await openCache();
  if (!cache) return false;
  const match = await cache.match(offlineUrlFor(resourceId));
  return Boolean(match);
}

export async function getOfflineBlob(resourceId: string): Promise<Blob | undefined> {
  const cache = await openCache();
  if (!cache) return undefined;
  const match = await cache.match(offlineUrlFor(resourceId));
  return match ? await match.blob() : undefined;
}

/** Deletes ONLY this resource's cached binary. */
export async function deleteOfflineBinary(resourceId: string): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  await cache.delete(offlineUrlFor(resourceId));
}

/** Resource ids currently present in Cache Storage. */
export async function listCachedResourceIds(): Promise<string[]> {
  const cache = await openCache();
  if (!cache) return [];
  const keys = await cache.keys();
  return keys
    .map((request) => new URL(request.url).pathname)
    .filter((pathname) => pathname.startsWith(OFFLINE_URL_PREFIX))
    .map((pathname) => decodeURIComponent(pathname.slice(OFFLINE_URL_PREFIX.length)));
}

/** Browser storage estimate. Values are never invented. */
export async function storageEstimate(): Promise<{ usage?: number; quota?: number } | undefined> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return undefined;
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage;
    const quota = estimate.quota;
    return {
      ...(typeof usage === "number" ? { usage } : {}),
      ...(typeof quota === "number" ? { quota } : {}),
    };
  } catch {
    return undefined;
  }
}

export function formatBytes(bytes: number | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "Size unavailable";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
