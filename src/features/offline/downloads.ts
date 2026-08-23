/**
 * Sprint 4B — explicit, user-initiated downloads of manifest resources.
 *
 * Rules enforced here:
 * - nothing downloads automatically;
 * - one active download per resourceId;
 * - AbortController cancellation;
 * - a partial or invalid body is NEVER stored as `ready`;
 * - only the requested response is cached.
 */

import type { OfflineResourceKind } from "@/db/schema";
import { offlineResourcesRepository } from "@/repositories/offlineResourcesRepository";
import { hasOfflineBinary, putOfflineBinary } from "./cache";
import { assertBinaryMatchesKind } from "./validation";

export interface DownloadProgress {
  resourceId: string;
  receivedBytes: number;
  /** Undefined when the server does not send Content-Length. */
  totalBytes?: number;
}

type Listener = (active: Record<string, DownloadProgress>) => void;

const controllers = new Map<string, AbortController>();
const progressMap: Record<string, DownloadProgress> = {};
const listeners = new Set<Listener>();

const emit = () => {
  const snapshot = { ...progressMap };
  for (const listener of listeners) listener(snapshot);
};

export const subscribeToDownloads = (listener: Listener) => {
  listeners.add(listener);
  listener({ ...progressMap });
  return () => listeners.delete(listener);
};

export const isDownloading = (resourceId: string) => controllers.has(resourceId);

export function cancelDownload(resourceId: string) {
  controllers.get(resourceId)?.abort();
}

export interface StartDownloadInput {
  resourceId: string;
  chapterId: string;
  kind: OfflineResourceKind;
  url: string;
  fileName?: string;
}

export async function startDownload(input: StartDownloadInput): Promise<void> {
  const { resourceId, chapterId, kind, url } = input;
  if (controllers.has(resourceId)) return; // no duplicate simultaneous downloads

  const controller = new AbortController();
  controllers.set(resourceId, controller);
  progressMap[resourceId] = { resourceId, receivedBytes: 0 };
  emit();

  await offlineResourcesRepository.upsert({
    resourceId,
    chapterId,
    kind,
    sourceType: "download",
    status: "downloading",
    sourceUrl: url,
    ...(input.fileName ? { originalFileName: input.fileName } : {}),
  });

  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error(`Download failed (HTTP ${response.status})`);

    const contentType = response.headers.get("content-type") ?? "";
    if (/text\/html/i.test(contentType)) {
      throw new Error("The server returned a web page instead of a file.");
    }
    const lengthHeader = response.headers.get("content-length");
    const totalBytes = lengthHeader ? Number(lengthHeader) : undefined;
    if (typeof totalBytes === "number" && Number.isFinite(totalBytes)) {
      progressMap[resourceId] = { resourceId, receivedBytes: 0, totalBytes };
      emit();
    }

    let blob: Blob;
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value as unknown as BlobPart);
          received += value.byteLength;
          progressMap[resourceId] = {
            resourceId,
            receivedBytes: received,
            ...(typeof totalBytes === "number" && Number.isFinite(totalBytes) ? { totalBytes } : {}),
          };
          emit();
        }
      }
      if (typeof totalBytes === "number" && Number.isFinite(totalBytes) && received !== totalBytes) {
        throw new Error("Download was incomplete.");
      }
      blob = new Blob(chunks, contentType ? { type: contentType } : {});
    } else {
      blob = await response.blob();
    }

    await assertBinaryMatchesKind(blob, kind, contentType);

    const stored = await putOfflineBinary(resourceId, blob, blob.type || contentType || "application/octet-stream");
    if (!stored || !(await hasOfflineBinary(resourceId))) {
      throw new Error("Offline storage is unavailable in this browser.");
    }

    await offlineResourcesRepository.upsert({
      resourceId,
      chapterId,
      kind,
      sourceType: "download",
      status: "ready",
      sourceUrl: url,
      mimeType: blob.type || contentType,
      sizeBytes: blob.size,
      ...(input.fileName ? { originalFileName: input.fileName } : {}),
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    // A cancelled or failed download never leaves a partial binary behind.
    await offlineResourcesRepository.remove(resourceId);
    if (!aborted) {
      await offlineResourcesRepository.upsert({
        resourceId,
        chapterId,
        kind,
        sourceType: "download",
        status: "error",
        sourceUrl: url,
        errorMessage: error instanceof Error ? error.message : "Download failed.",
      });
      throw error;
    }
  } finally {
    controllers.delete(resourceId);
    delete progressMap[resourceId];
    emit();
  }
}
