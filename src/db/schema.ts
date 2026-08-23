/**
 * Local database schema (Dexie / IndexedDB).
 *
 * Only typed record shapes, store names and index declarations live here.
 * Reading progress uses `maxPageReached` (resume = `lastPage`); audio progress
 * uses `maxPosition` (resume = `currentTime`). Never wipe user data on upgrade.
 */

export const DB_NAME = "ENCORStudyDB";

/** Bump on every schema change and add an explicit `db.version(n).upgrade()`. */
export const DB_VERSION = 5;

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
  mediaTrackStates: "mediaTrackStates",
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
export type OfflineResourceKind = "pdf" | "audio" | "video";
export type OfflineSourceType = "download" | "local-import";
export type OfflineResourceStatus = "downloading" | "ready" | "error";

export interface OfflineResourceRecord {
  /** `${resourceId}` — one offline binary per resource identity. */
  id: string;
  resourceId: string;
  chapterId: string;
  /**
   * Sprint 6A.1 (v5) — optional MediaTrack association for audio/video rows.
   * Legacy rows written before v5 have neither field; they stay valid and are
   * only used as a chapter-wide fallback when the chapter declares exactly one
   * MediaTrack (see `src/features/media/tracks.ts`). PDF rows never set these.
   */
  trackId?: string;
  /** Manifest rendition this offline copy stands in for (`videoResourceId`). */
  targetResourceId?: string;
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


/**
 * Sprint 6A.1 — shared state of one logical MediaTrack.
 *
 * An MP3 exported from an MP4 is one learning item with two renditions, so the
 * position is stored as a DURATION-INDEPENDENT ratio and shared by both:
 *   targetTime = resumeRatio * targetDuration
 * `maxRatio` is monotonic and is the ONLY media progress measure, so listening
 * and then watching never counts twice.
 */
export interface MediaTrackState {
  /** `${chapterId}:${trackId}`. */
  id: string;
  chapterId: string;
  trackId: string;
  currentMode: "audio" | "video";
  /** Resume position, 0..1. */
  resumeRatio: number;
  /** Furthest position reached, 0..1, monotonic. */
  maxRatio: number;
  /** Only set once a real duration was measured by the browser. */
  audioDuration?: number;
  videoDuration?: number;
  playbackRate?: number;
  updatedAt: string;
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


/**
 * Version 4 (Sprint 6A.1) — adds shared MediaTrack state only. Additive: no
 * existing store is modified, and playbackStates keeps every audio write the
 * AudioController performs today.
 */
export const SCHEMA_V4 = {
  mediaTrackStates: "id, chapterId, trackId, [chapterId+trackId], currentMode, updatedAt",
} as const;

/**
 * Version 5 (Sprint 6A.1 fix) — track-scoped offline resources. Additive
 * INDEXES only on the existing `offlineResources` store: no row is rewritten,
 * deleted or migrated, and legacy rows without `trackId` keep working.
 */
export const SCHEMA_V5 = {
  offlineResources:
    "id, resourceId, chapterId, kind, status, sourceType, trackId, targetResourceId, " +
    "[chapterId+kind], [chapterId+trackId], updatedAt",
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
