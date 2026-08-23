/** Live counts and local backup bookkeeping for the Settings section. */

import { useLiveQuery } from "dexie-react-hooks";

import { getDb } from "@/db/database";
import { BACKUP_META_KEYS, type RestoreCounts } from "./format";

export interface BackupStats {
  readingCount: number;
  audioCount: number;
  noteCount: number;
  bookmarkCount: number;
  lastBackupAt?: string;
  lastRestoreAt?: string;
  lastRestoreFileName?: string;
  lastRestoreCounts?: RestoreCounts;
}

export function useBackupStats(): BackupStats {
  const stats = useLiveQuery(async () => {
    const db = getDb();
    if (!db) return undefined;
    const [readingCount, audioCount, noteCount, bookmarkCount, backupAt, restoreAt, fileName, countsRow] =
      await Promise.all([
        db.readingStates.count(),
        db.playbackStates.count(),
        db.readerNotes.count(),
        db.readerBookmarks.count(),
        db.settings.get(BACKUP_META_KEYS.lastBackupAt),
        db.settings.get(BACKUP_META_KEYS.lastRestoreAt),
        db.settings.get(BACKUP_META_KEYS.lastRestoreFileName),
        db.settings.get(BACKUP_META_KEYS.lastRestoreCounts),
      ]);
    return {
      readingCount,
      audioCount,
      noteCount,
      bookmarkCount,
      lastBackupAt: backupAt?.value as string | undefined,
      lastRestoreAt: restoreAt?.value as string | undefined,
      lastRestoreFileName: fileName?.value as string | undefined,
      lastRestoreCounts: countsRow?.value as RestoreCounts | undefined,
    } satisfies BackupStats;
  }, []);

  return (
    stats ?? { readingCount: 0, audioCount: 0, noteCount: 0, bookmarkCount: 0 }
  );
}
