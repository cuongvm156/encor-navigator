/**
 * Local database schema (skeleton).
 *
 * Sprint 2 will back this with Dexie / IndexedDB. Only typed record shapes and
 * store names live here — no runtime database code yet.
 */

export const DB_NAME = "encor-study";

/** Bump on every schema change and add a migration. Never wipe user data. */
export const DB_VERSION = 1;

export const STORES = {
  reading: "reading",
  playback: "playback",
  notes: "notes",
  bookmarks: "bookmarks",
  settings: "settings",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/** Reading position for one chapter's PDF. */
export interface ReadingRecord {
  chapterId: string;
  /** Resume point. */
  lastPage: number;
  /** Furthest page reached — the progress measure. */
  maxPageReached: number;
  totalPages: number;
  updatedAt: string;
}

/** Playback position for one chapter's audio track. */
export interface PlaybackRecord {
  chapterId: string;
  currentTime: number;
  maxPosition: number;
  duration: number;
  playbackRate: number;
  repeatMode: "off" | "once" | "lesson";
  updatedAt: string;
}

export interface NoteRecord {
  id: string;
  chapterId: string;
  body: string;
  type: "Note" | "Important" | "Review";
  page?: number;
  timeSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkRecord {
  id: string;
  chapterId: string;
  target: "pdf" | "audio";
  page?: number;
  timeSeconds?: number;
  label?: string;
  createdAt: string;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

/** Shape of a backup / restore payload. */
export interface BackupPayload {
  dbVersion: number;
  exportedAt: string;
  reading: ReadingRecord[];
  playback: PlaybackRecord[];
  notes: NoteRecord[];
  bookmarks: BookmarkRecord[];
  settings: SettingsRecord[];
}
