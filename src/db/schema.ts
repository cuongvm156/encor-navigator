/**
 * Local database schema (Dexie / IndexedDB).
 *
 * Only typed record shapes, store names and index declarations live here.
 * Reading progress uses `maxPageReached` (resume = `lastPage`); audio progress
 * uses `maxPosition` (resume = `currentTime`). Never wipe user data on upgrade.
 */

export const DB_NAME = "ENCORStudyDB";

/** Bump on every schema change and add an explicit `db.version(n).upgrade()`. */
export const DB_VERSION = 3;

export const STORES = {
  readingStates: "readingStates",
  playbackStates: "playbackStates",
  progress: "progress",
  notes: "notes",
  bookmarks: "bookmarks",
  studySessions: "studySessions",
  settings: "settings",
  readerNotes: "readerNotes",
  readerBookmarks: "readerBookmarks",
  offlineResources: "offlineResources",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];


export type RepeatMode = "off" | "once" | "lesson";
export type NoteKind = "note" | "important" | "review";
export type BookmarkKind = "pdf_page" | "audio_timestamp";
export type ChapterStatusValue = "not_started" | "in_progress" | "completed";
export type ActivityType = "reading" | "audio";

/** Reading position for one chapter resource (PDF). */
export interface ReadingState {
  /** Stable string id — `${chapterId}:${resourceId}`. */
  id: string;
  chapterId: string;
  resourceId: string;
  /** Resume point. */
  lastPage: number;
  /** Furthest page reached — the progress measure, monotonic. */
  maxPageReached: number;
  totalPages: number;
  updatedAt: string;
}

/** Playback position for one chapter audio resource. */
export interface PlaybackState {
  /** Stable string id — `${chapterId}:${resourceId}`. */
  id: string;
  chapterId: string;
  resourceId: string;
  /** Resume point, seconds. */
  currentTime: number;
  /** Furthest position reached, seconds — the progress measure, monotonic. */
  maxPosition: number;
  duration: number;
  playbackRate: number;
  repeatMode: RepeatMode;
  updatedAt: string;
}

/** Persisted per-chapter progress. Reading and audio stay independent. */
export interface ProgressRecord {
  /** Stable string id — the chapterId. */
  id: string;
  chapterId: string;
  readingRatio: number;
  audioRatio: number;
  status: ChapterStatusValue;
  updatedAt: string;
}

export interface NoteRecord {
  id: string;
  chapterId: string;
  resourceId?: string;
  type: NoteKind;
  content: string;
  page?: number;
  audioTimestamp?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkRecord {
  id: string;
  chapterId: string;
  resourceId?: string;
  type: BookmarkKind;
  page?: number;
  audioTimestamp?: number;
  label?: string;
  createdAt: string;
}

export interface StudySession {
  id: string;
  chapterId: string;
  resourceId?: string;
  activityType: ActivityType;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

/**
 * Sprint 3D — offline reader annotations.
 *
 * Both records are keyed by the document identity (`pdfResourceId`) plus the
 * 1-based `pageNumber`, so replacing a document never mixes annotations.
 */
export interface ReaderBookmarkRecord {
  id: string;
  chapterId: string;
  pdfResourceId: string;
  pageNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReaderNoteRecord {
  id: string;
  chapterId: string;
  pdfResourceId: string;
  pageNumber: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sprint 4B — offline resource metadata (Cache Storage holds the binary).
 *
 * `offlineUrl` is a stable same-origin synthetic URL served by the service
 * worker; object URLs are never persisted here.
 */
export type OfflineResourceKind = "pdf" | "audio";
export type OfflineSourceType = "download" | "local-import";
export type OfflineResourceStatus = "downloading" | "ready" | "error";

export interface OfflineResourceRecord {
  /** `${resourceId}` — one offline binary per resource identity. */
  id: string;
  resourceId: string;
  chapterId: string;
  kind: OfflineResourceKind;
  sourceType: OfflineSourceType;
  sourceUrl?: string;
  offlineUrl: string;
  originalFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  status: OfflineResourceStatus;
  downloadedAt?: string;
  updatedAt: string;
  errorMessage?: string;
}


/** Dexie index declarations for version 1. */
export const SCHEMA_V1 = {
  readingStates: "id, chapterId, resourceId, updatedAt",
  playbackStates: "id, chapterId, resourceId, updatedAt",
  progress: "id, chapterId, status, updatedAt",
  notes: "id, chapterId, resourceId, type, updatedAt, createdAt",
  bookmarks: "id, chapterId, resourceId, type, createdAt",
  studySessions: "id, chapterId, resourceId, activityType, startedAt",
  settings: "key, updatedAt",
} as const;

/**
 * Version 2 — adds the reader annotation stores only. Existing stores are
 * untouched, so no data migration is needed for them.
 */
export const SCHEMA_V2 = {
  readerNotes: "id, chapterId, pdfResourceId, pageNumber, [pdfResourceId+pageNumber], updatedAt, createdAt",
  readerBookmarks:
    "id, chapterId, pdfResourceId, pageNumber, &[pdfResourceId+pageNumber], createdAt, updatedAt",
} as const;

/**
 * Version 3 (Sprint 4B) — adds offline resource METADATA only. Cache Storage
 * holds the binaries; this table stays searchable metadata. Additive: no
 * existing store is modified and no user data is migrated or removed.
 */
export const SCHEMA_V3 = {
  offlineResources: "id, resourceId, chapterId, kind, status, sourceType, [chapterId+kind], updatedAt",
} as const;


/** Shape of a backup / restore payload. */
export interface BackupPayload {
  dbVersion: number;
  exportedAt: string;
  readingStates: ReadingState[];
  playbackStates: PlaybackState[];
  progress: ProgressRecord[];
  notes: NoteRecord[];
  bookmarks: BookmarkRecord[];
  studySessions: StudySession[];
  settings: SettingRecord[];
  readerNotes?: ReaderNoteRecord[];
  readerBookmarks?: ReaderBookmarkRecord[];
}


/** Stable composite id helper. */
export const resourceKey = (chapterId: string, resourceId: string) =>
  `${chapterId}:${resourceId}`;
