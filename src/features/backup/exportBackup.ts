/**
 * Builds and delivers a backup file. Reading data only — no binaries, no cache
 * entries, no resource URLs, no credentials. Nothing is uploaded anywhere.
 */

import { mediaTrackStatesRepository } from "@/repositories/mediaTrackStatesRepository";
import { playbackRepository } from "@/repositories/playbackRepository";
import { readingRepository } from "@/repositories/readingRepository";
import {
  bookmarksRepository,
  readerNotesRepository,
} from "@/repositories/readerAnnotationsRepository";
import { settingsRepository } from "@/repositories/settingsRepository";

import {
  ALLOWED_SETTING_KEYS,
  BACKUP_APP_VERSION,
  BACKUP_COURSE_ID,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_META_KEYS,
  backupFileName,
  type BackupPayloadV1,
} from "./format";

export async function buildBackupPayload(): Promise<BackupPayloadV1> {
  const [reading, playback, notes, bookmarks, mediaTracks] = await Promise.all([
    readingRepository.getAll(),
    playbackRepository.getAll(),
    readerNotesRepository.getAll(),
    bookmarksRepository.getAll(),
    mediaTrackStatesRepository.getAll(),
  ]);

  const settings: Record<string, unknown> = {};
  for (const key of ALLOWED_SETTING_KEYS) {
    const value = await settingsRepository.get<unknown>(key);
    if (value !== undefined) settings[key] = value;
  }

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: BACKUP_APP_VERSION,
    courseId: BACKUP_COURSE_ID,
    exportedAt: new Date().toISOString(),
    data: {
      readingProgress: reading.map((r) => ({
        chapterId: r.chapterId,
        pdfResourceId: r.resourceId,
        lastPage: r.lastPage,
        maxPageReached: r.maxPageReached,
        updatedAt: r.updatedAt,
      })),
      audioProgress: playback.map((p) => ({
        chapterId: p.chapterId,
        audioResourceId: p.resourceId,
        currentTime: p.currentTime,
        maxPosition: p.maxPosition,
        ...(p.duration > 0 ? { duration: p.duration } : {}),
        updatedAt: p.updatedAt,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        chapterId: n.chapterId,
        pdfResourceId: n.pdfResourceId,
        pageNumber: n.pageNumber,
        body: n.body,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      bookmarks: bookmarks.map((b) => ({
        id: b.id,
        chapterId: b.chapterId,
        pdfResourceId: b.pdfResourceId,
        pageNumber: b.pageNumber,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
      // Shared audio+video track state (ratios only — no media binaries).
      mediaTracks: mediaTracks.map((m) => ({
        chapterId: m.chapterId,
        trackId: m.trackId,
        currentMode: m.currentMode,
        resumeRatio: m.resumeRatio,
        maxRatio: m.maxRatio,
        ...(m.audioDuration ? { audioDuration: m.audioDuration } : {}),
        ...(m.videoDuration ? { videoDuration: m.videoDuration } : {}),
        updatedAt: m.updatedAt,
      })),
      settings,
    },
  };
}

export type ExportMethod = "share" | "download";

/**
 * Exports the backup. On iPhone the Web Share API is preferred so the user can
 * choose "Save to Files"; otherwise a normal browser download is used.
 * Learning data is never modified — only `lastBackupAt` is recorded.
 */
export async function exportBackup(): Promise<{ method: ExportMethod; fileName: string }> {
  const payload = await buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const fileName = backupFileName();
  const blob = new Blob([json], { type: "application/json" });

  let method: ExportMethod = "download";
  const file =
    typeof File !== "undefined" ? new File([blob], fileName, { type: "application/json" }) : null;

  if (
    file &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: fileName });
      method = "share";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      method = "download";
    }
  }

  if (method === "download") {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  await settingsRepository.set(BACKUP_META_KEYS.lastBackupAt, new Date().toISOString());
  return { method, fileName };
}
