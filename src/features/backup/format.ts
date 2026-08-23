/**
 * Sprint 5A — versioned backup format for learning data only.
 *
 * Backups contain reading progress, audio progress, reader notes, reader
 * bookmarks and a small allow-list of preferences. They never contain PDF or
 * audio binaries, Cache Storage entries, offline-resource metadata, resource
 * URLs, credentials or logs.
 */

export const BACKUP_FORMAT = "encor-navigator-backup" as const;
// v2 (Sprint 6A.1) adds shared MediaTrack state. v1 files stay restorable.
export const BACKUP_FORMAT_VERSION = 2 as const;
export const SUPPORTED_FORMAT_VERSIONS = [1, 2] as const;
export const BACKUP_COURSE_ID = "encor-350-401-v2" as const;
export const BACKUP_APP_VERSION = "1.0.0" as const;

/** Hard ceiling for an accepted backup file (bytes). */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_RECORDS_PER_COLLECTION = 20_000;
export const MAX_NOTE_BODY_LENGTH = 20_000;

/** Settings keys that may be exported and restored. Everything else is ignored. */
export const ALLOWED_SETTING_KEYS = [
  "audio.playbackRate",
  "audio.repeatMode",
  "audio.seekInterval",
  "reader.zoom",
  "ui.theme",
] as const;

/** Local-only bookkeeping keys (never included in a backup payload). */
export const BACKUP_META_KEYS = {
  lastBackupAt: "backup.lastBackupAt",
  lastRestoreAt: "backup.lastRestoreAt",
  lastRestoreFileName: "backup.lastRestoreFileName",
  lastRestoreCounts: "backup.lastRestoreCounts",
} as const;

export interface BackupReadingProgress {
  chapterId: string;
  pdfResourceId: string;
  lastPage: number;
  maxPageReached: number;
  updatedAt: string;
}

export interface BackupAudioProgress {
  chapterId: string;
  audioResourceId: string;
  currentTime: number;
  maxPosition: number;
  /** Only present when a real duration was previously measured. */
  duration?: number;
  updatedAt: string;
}

/** Shared audio+video state of one logical MediaTrack (ratios, 0..1). */
export interface BackupMediaTrack {
  chapterId: string;
  trackId: string;
  currentMode: "audio" | "video";
  resumeRatio: number;
  maxRatio: number;
  audioDuration?: number;
  videoDuration?: number;
  updatedAt: string;
}

export interface BackupNote {
  id: string;
  chapterId: string;
  pdfResourceId: string;
  pageNumber: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupBookmark {
  id: string;
  chapterId: string;
  pdfResourceId: string;
  pageNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPayloadV1 {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  courseId: string;
  exportedAt: string;
  data: {
    readingProgress: BackupReadingProgress[];
    audioProgress: BackupAudioProgress[];
    notes: BackupNote[];
    bookmarks: BackupBookmark[];
    /** Absent in v1 files. */
    mediaTracks?: BackupMediaTrack[];
    settings: Record<string, unknown>;
  };
}

export interface RestoreCounts {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
}

export const emptyCounts = (): RestoreCounts => ({
  added: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
});

export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `encor-navigator-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(
    date.getDate(),
  )}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}

export const NO_MEDIA_NOTICE =
  "This backup does not contain downloaded or imported PDF, audio or video files. Those resources must be downloaded or imported again on this device.";
