/**
 * Sprint 4B — local file import.
 *
 * The selected file is read in the browser and stored in Cache Storage on THIS
 * device only. Nothing is uploaded to Lovable, GitHub or any server, so
 * copyrighted Cisco Press material never leaves the device.
 */

import type { OfflineResourceKind } from "@/db/schema";
import { offlineResourcesRepository } from "@/repositories/offlineResourcesRepository";
import { hasOfflineBinary, putOfflineBinary } from "./cache";
import { assertBinaryMatchesKind } from "./validation";

/** New identity per imported file — never reuses a manifest/test resourceId. */
export const localResourceId = (chapterId: string, kind: OfflineResourceKind) =>
  `local-${chapterId}-${kind}-${Date.now()}`;

const DEFAULT_MIME: Record<OfflineResourceKind, string> = {
  pdf: "application/pdf",
  audio: "audio/mpeg",
  video: "video/mp4",
};

export const isLocalResourceId = (resourceId: string) => resourceId.startsWith("local-");

export interface ImportFileInput {
  chapterId: string;
  kind: OfflineResourceKind;
  file: File;
  /** Existing local resource to replace (confirmed by the caller). */
  replacesResourceId?: string;
}

export async function importLocalFile(input: ImportFileInput): Promise<string> {
  const { chapterId, kind, file } = input;
  await assertBinaryMatchesKind(file, kind, file.type);

  const resourceId = localResourceId(chapterId, kind);
  const stored = await putOfflineBinary(
    resourceId,
    file,
    file.type || DEFAULT_MIME[kind],
  );
  if (!stored || !(await hasOfflineBinary(resourceId))) {
    throw new Error("Offline storage is unavailable in this browser.");
  }

  await offlineResourcesRepository.upsert({
    resourceId,
    chapterId,
    kind,
    sourceType: "local-import",
    status: "ready",
    originalFileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });

  // Replacement removes ONLY the previous binary + offline metadata. Reading
  // progress, playback state, notes and bookmarks of the old resourceId stay.
  if (input.replacesResourceId && input.replacesResourceId !== resourceId) {
    await offlineResourcesRepository.remove(input.replacesResourceId);
  }

  return resourceId;
}
