/**
 * Safe merge restore (Sprint 5A).
 *
 * All writes happen inside a single Dexie transaction — any failure rolls the
 * whole restore back and leaves existing data untouched. Nothing is ever
 * cleared or replaced: progress values only move forward.
 */

import { getDb } from "@/db/database";
import {
  resourceKey,
  type PlaybackState,
  type ReaderBookmarkRecord,
  type ReaderNoteRecord,
  type ReadingState,
} from "@/db/schema";
import { progressRepository } from "@/repositories/progressRepository";

import {
  ALLOWED_SETTING_KEYS,
  BACKUP_META_KEYS,
  emptyCounts,
  type BackupPayloadV1,
  type RestoreCounts,
} from "./format";

const isNewer = (a: string, b: string) => Date.parse(a) > Date.parse(b);
const nowIso = () => new Date().toISOString();

export interface RestorePreview {
  exportedAt: string;
  courseId: string;
  appVersion: string;
  readingCount: number;
  audioCount: number;
  noteCount: number;
  bookmarkCount: number;
  settingCount: number;
  newRecords: number;
  mergedRecords: number;
  skipped: number;
}

/** Read-only analysis of what a restore would do. Writes nothing. */
export async function previewRestore(
  payload: BackupPayloadV1,
  skipped = 0,
): Promise<RestorePreview> {
  const db = getDb();
  const { readingProgress, audioProgress, notes, bookmarks, settings } = payload.data;
  const mediaTracks = payload.data.mediaTracks ?? [];

  let newRecords = 0;
  let mergedRecords = 0;

  if (db) {
    const [existingReading, existingPlayback, existingNotes, existingBookmarks] =
      await Promise.all([
        db.readingStates.toArray(),
        db.playbackStates.toArray(),
        db.readerNotes.toArray(),
        db.readerBookmarks.toArray(),
      ]);

    const readingIds = new Set(existingReading.map((r) => r.resourceId));
    const playbackIds = new Set(existingPlayback.map((p) => p.resourceId));
    const noteIds = new Set(existingNotes.map((n) => n.id));
    const bookmarkKeys = new Set(
      existingBookmarks.map((b) => `${b.pdfResourceId}#${b.pageNumber}`),
    );

    const tally = (matches: boolean) => {
      if (matches) mergedRecords += 1;
      else newRecords += 1;
    };
    for (const r of readingProgress) tally(readingIds.has(r.pdfResourceId));
    for (const a of audioProgress) tally(playbackIds.has(a.audioResourceId));
    for (const n of notes) tally(noteIds.has(n.id));
    for (const b of bookmarks) tally(bookmarkKeys.has(`${b.pdfResourceId}#${b.pageNumber}`));
    const existingTracks = await db.mediaTrackStates.toArray();
    const trackIds = new Set(existingTracks.map((t) => t.id));
    for (const m of mediaTracks) tally(trackIds.has(`${m.chapterId}:${m.trackId}`));
  } else {
    newRecords =
      readingProgress.length +
      audioProgress.length +
      notes.length +
      bookmarks.length +
      mediaTracks.length;
  }

  return {
    exportedAt: payload.exportedAt,
    courseId: payload.courseId,
    appVersion: payload.appVersion,
    readingCount: readingProgress.length,
    audioCount: audioProgress.length,
    noteCount: notes.length,
    bookmarkCount: bookmarks.length,
    settingCount: Object.keys(settings).length,
    newRecords,
    mergedRecords,
    skipped,
  };
}

export interface RestoreResult extends RestoreCounts {
  chaptersTouched: string[];
}

export async function restoreBackup(
  payload: BackupPayloadV1,
  options: { fileName?: string; skipped?: number } = {},
): Promise<RestoreResult> {
  const db = getDb();
  if (!db) throw new Error("Local database is unavailable in this browser.");

  const counts: RestoreCounts = { ...emptyCounts(), skipped: options.skipped ?? 0 };
  const chaptersTouched = new Set<string>();
  const { readingProgress, audioProgress, notes, bookmarks, settings } = payload.data;
  const mediaTracks = payload.data.mediaTracks ?? [];

  await db.transaction(
    "rw",
    [
      db.readingStates,
      db.playbackStates,
      db.readerNotes,
      db.readerBookmarks,
      db.mediaTrackStates,
      db.settings,
    ],
    async () => {
      // Reading progress — matched by pdfResourceId, maxPageReached never drops.
      for (const row of readingProgress) {
        const existing = await db.readingStates
          .where("resourceId")
          .equals(row.pdfResourceId)
          .first();
        if (!existing) {
          const record: ReadingState = {
            id: resourceKey(row.chapterId, row.pdfResourceId),
            chapterId: row.chapterId,
            resourceId: row.pdfResourceId,
            lastPage: row.lastPage,
            maxPageReached: row.maxPageReached,
            // Real page count is resolved by the reader when the PDF loads.
            totalPages: 0,
            updatedAt: row.updatedAt,
          };
          await db.readingStates.put(record);
          counts.added += 1;
          chaptersTouched.add(row.chapterId);
          continue;
        }
        const backupNewer = isNewer(row.updatedAt, existing.updatedAt);
        const next: ReadingState = {
          ...existing,
          lastPage: backupNewer ? row.lastPage : existing.lastPage,
          maxPageReached: Math.max(existing.maxPageReached, row.maxPageReached),
          updatedAt: backupNewer ? row.updatedAt : existing.updatedAt,
        };
        if (
          next.lastPage === existing.lastPage &&
          next.maxPageReached === existing.maxPageReached
        ) {
          counts.unchanged += 1;
        } else {
          await db.readingStates.put(next);
          counts.updated += 1;
          chaptersTouched.add(existing.chapterId);
        }
      }

      // Audio progress — matched by audioResourceId, maxPosition never drops.
      for (const row of audioProgress) {
        const existing = await db.playbackStates
          .where("resourceId")
          .equals(row.audioResourceId)
          .first();
        if (!existing) {
          const record: PlaybackState = {
            id: resourceKey(row.chapterId, row.audioResourceId),
            chapterId: row.chapterId,
            resourceId: row.audioResourceId,
            currentTime: row.currentTime,
            maxPosition: row.maxPosition,
            duration: row.duration ?? 0,
            playbackRate: 1,
            repeatMode: "off",
            updatedAt: row.updatedAt,
          };
          await db.playbackStates.put(record);
          counts.added += 1;
          chaptersTouched.add(row.chapterId);
          continue;
        }
        const backupNewer = isNewer(row.updatedAt, existing.updatedAt);
        const next: PlaybackState = {
          ...existing,
          currentTime: backupNewer ? row.currentTime : existing.currentTime,
          maxPosition: Math.max(existing.maxPosition, row.maxPosition),
          duration: existing.duration > 0 ? existing.duration : (row.duration ?? 0),
          updatedAt: backupNewer ? row.updatedAt : existing.updatedAt,
        };
        if (
          next.currentTime === existing.currentTime &&
          next.maxPosition === existing.maxPosition &&
          next.duration === existing.duration
        ) {
          counts.unchanged += 1;
        } else {
          await db.playbackStates.put(next);
          counts.updated += 1;
          chaptersTouched.add(existing.chapterId);
        }
      }

      // Notes — matched by id; newer updatedAt wins, bodies are never merged.
      for (const row of notes) {
        const existing = await db.readerNotes.get(row.id);
        const record: ReaderNoteRecord = {
          id: row.id,
          chapterId: row.chapterId,
          pdfResourceId: row.pdfResourceId,
          pageNumber: row.pageNumber,
          body: row.body,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
        if (!existing) {
          await db.readerNotes.put(record);
          counts.added += 1;
        } else if (isNewer(row.updatedAt, existing.updatedAt)) {
          await db.readerNotes.put({ ...existing, ...record });
          counts.updated += 1;
        } else {
          counts.unchanged += 1;
        }
      }

      // Bookmarks — deduplicated by pdfResourceId + pageNumber.
      for (const row of bookmarks) {
        const existing = await db.readerBookmarks.get({
          pdfResourceId: row.pdfResourceId,
          pageNumber: row.pageNumber,
        });
        if (!existing) {
          const record: ReaderBookmarkRecord = {
            id: row.id,
            chapterId: row.chapterId,
            pdfResourceId: row.pdfResourceId,
            pageNumber: row.pageNumber,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
          await db.readerBookmarks.put(record);
          counts.added += 1;
        } else if (isNewer(row.updatedAt, existing.updatedAt)) {
          await db.readerBookmarks.put({
            ...existing,
            chapterId: row.chapterId,
            createdAt: existing.createdAt,
            updatedAt: row.updatedAt,
          });
          counts.updated += 1;
        } else {
          counts.unchanged += 1;
        }
      }

      // Shared MediaTrack state — `maxRatio` never decreases; the resume point
      // follows the newer `updatedAt`. Ignored for v1 backups (empty array).
      for (const row of mediaTracks) {
        const id = `${row.chapterId}:${row.trackId}`;
        const existing = await db.mediaTrackStates.get(id);
        if (!existing) {
          await db.mediaTrackStates.put({ id, ...row });
          chaptersTouched.add(row.chapterId);
          counts.added += 1;
          continue;
        }
        const incomingNewer = Date.parse(row.updatedAt) > Date.parse(existing.updatedAt);
        const merged = {
          ...existing,
          maxRatio: Math.max(existing.maxRatio, row.maxRatio),
          resumeRatio: incomingNewer ? row.resumeRatio : existing.resumeRatio,
          currentMode: incomingNewer ? row.currentMode : existing.currentMode,
          audioDuration: existing.audioDuration ?? row.audioDuration,
          videoDuration: existing.videoDuration ?? row.videoDuration,
          updatedAt: incomingNewer ? row.updatedAt : existing.updatedAt,
        };
        const changed =
          merged.maxRatio !== existing.maxRatio ||
          merged.resumeRatio !== existing.resumeRatio ||
          merged.audioDuration !== existing.audioDuration ||
          merged.videoDuration !== existing.videoDuration;
        if (changed) {
          await db.mediaTrackStates.put(merged);
          chaptersTouched.add(row.chapterId);
          counts.updated += 1;
        } else {
          counts.unchanged += 1;
        }
      }

      // Settings — allow-list only; unknown keys are ignored.
      for (const key of ALLOWED_SETTING_KEYS) {
        const value = settings[key];
        if (value === undefined) continue;
        const existing = await db.settings.get(key);
        if (existing && JSON.stringify(existing.value) === JSON.stringify(value)) {
          counts.unchanged += 1;
          continue;
        }
        await db.settings.put({ key, value, updatedAt: nowIso() });
        if (existing) counts.updated += 1;
        else counts.added += 1;
      }

      const restoredAt = nowIso();
      await db.settings.put({
        key: BACKUP_META_KEYS.lastRestoreAt,
        value: restoredAt,
        updatedAt: restoredAt,
      });
      if (options.fileName) {
        await db.settings.put({
          key: BACKUP_META_KEYS.lastRestoreFileName,
          value: options.fileName,
          updatedAt: restoredAt,
        });
      }
      await db.settings.put({
        key: BACKUP_META_KEYS.lastRestoreCounts,
        value: { ...counts },
        updatedAt: restoredAt,
      });
    },
  );

  // Derived chapter ratios are recomputed after the merge commits.
  for (const chapterId of chaptersTouched) {
    await progressRepository.recalculateChapter(chapterId);
  }

  return { ...counts, chaptersTouched: [...chaptersTouched] };
}
