/**
 * Dexie database entry point (browser only).
 *
 * Rules:
 * - never call `db.delete()` / `indexedDB.deleteDatabase()` — user data survives upgrades
 * - future schema changes add `db.version(n).stores(...).upgrade(...)`, never destructive fallbacks
 * - only repositories in `src/repositories/*` may import this module; UI must not
 */

import Dexie, { type Table } from "dexie";

import {
  DB_NAME,
  DB_VERSION,
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
  type BookmarkRecord,
  type NoteRecord,
  type MediaTrackState,
  type OfflineResourceRecord,
  type PlaybackState,
  type ProgressRecord,
  type ReaderBookmarkRecord,
  type ReaderNoteRecord,
  type ReadingState,
  type SettingRecord,
  type StudySession,
} from "./schema";

export class ENCORStudyDatabase extends Dexie {
  readingStates!: Table<ReadingState, string>;
  playbackStates!: Table<PlaybackState, string>;
  progress!: Table<ProgressRecord, string>;
  notes!: Table<NoteRecord, string>;
  bookmarks!: Table<BookmarkRecord, string>;
  studySessions!: Table<StudySession, string>;
  settings!: Table<SettingRecord, string>;
  readerNotes!: Table<ReaderNoteRecord, string>;
  readerBookmarks!: Table<ReaderBookmarkRecord, string>;
  offlineResources!: Table<OfflineResourceRecord, string>;
  mediaTrackStates!: Table<MediaTrackState, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores(SCHEMA_V1);
    // v2 (Sprint 3D): additive only — new annotation stores, existing data kept.
    this.version(2).stores(SCHEMA_V2);
    // v3 (Sprint 4B): additive only — offline resource metadata. No data is
    // migrated, rewritten or deleted; progress, notes and bookmarks are kept.
    this.version(3).stores(SCHEMA_V3);
    // v4 (Sprint 6A.1): additive only — shared MediaTrack state. No existing
    // store is modified; no progress, playback state, note or bookmark is
    // migrated, rewritten or deleted.
    this.version(4).stores(SCHEMA_V4);
    // v5 (Sprint 6A.1 fix): additive INDEXES only — offlineResources gains
    // optional trackId / targetResourceId indexes so an imported MP4 belongs to
    // exactly one MediaTrack. No row is rewritten, migrated or deleted.
    this.version(DB_VERSION).stores(SCHEMA_V5);
  }
}



export const isBrowser = () =>
  typeof window !== "undefined" && typeof indexedDB !== "undefined";

let instance: ENCORStudyDatabase | undefined;

/**
 * Lazily creates the Dexie instance in the browser. Returns `undefined` during
 * SSR / prerender so no server code path touches IndexedDB.
 */
export function getDb(): ENCORStudyDatabase | undefined {
  if (!isBrowser()) return undefined;
  if (!instance) {
    try {
      instance = new ENCORStudyDatabase();
      instance.open().catch((error) => {
        // Surface the failure — never delete or reset the user's database.
        console.error("[ENCORStudyDB] failed to open database", error);
      });
    } catch (error) {
      console.error("[ENCORStudyDB] failed to construct database", error);
      return undefined;
    }
  }
  return instance;
}

export const dbConfig = {
  name: DB_NAME,
  version: DB_VERSION,
  stores: { ...SCHEMA_V1, ...SCHEMA_V2, ...SCHEMA_V3, ...SCHEMA_V4, ...SCHEMA_V5 },
} as const;

