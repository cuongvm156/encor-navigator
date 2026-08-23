/**
 * Sprint 4B — binary validation. Prevents HTML error pages or mismatched file
 * types from being stored as a chapter PDF or audio track.
 */

import type { OfflineResourceKind } from "@/db/schema";

const PDF_SIGNATURE = "%PDF";

export async function looksLikePdf(blob: Blob): Promise<boolean> {
  const head = await blob.slice(0, 5).text();
  return head.startsWith(PDF_SIGNATURE);
}

export const isAudioMimeType = (mime: string) =>
  /^audio\//i.test(mime) ||
  /^video\/(mp4|mpeg|ogg|webm)$/i.test(mime) ||
  /^application\/(ogg|octet-stream)$/i.test(mime);

/** Confirms an audio blob really decodes, using a native HTMLAudioElement. */
export function audioMetadataLoads(blob: Blob, timeoutMs = 15000): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    // Temporary object URL — used only for probing and revoked immediately.
    const probeUrl = URL.createObjectURL(blob);
    const audio = new Audio();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(probeUrl);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", () => finish(Number.isFinite(audio.duration)));
    audio.addEventListener("error", () => finish(false));
    audio.src = probeUrl;
  });
}

/** Throws with a user-readable message when the blob does not match the kind. */
export async function assertBinaryMatchesKind(
  blob: Blob,
  kind: OfflineResourceKind,
  contentType = "",
): Promise<void> {
  const mime = blob.type || contentType;
  if (kind === "pdf") {
    if (!(await looksLikePdf(blob))) {
      throw new Error("This file is not a valid PDF document.");
    }
    return;
  }
  if (!isAudioMimeType(mime)) {
    throw new Error(`Unsupported audio type${mime ? ` (${mime})` : ""}.`);
  }
  if (!(await audioMetadataLoads(blob))) {
    throw new Error("This audio file could not be played by the browser.");
  }
}
