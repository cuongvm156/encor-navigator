/**
 * Reading repository — placeholder contract.
 *
 * Owns PDF reading position. Progress uses `maxPageReached`; resume uses
 * `lastPage`. Implementation (Dexie) lands in Sprint 2.
 */

import type { ReadingRecord } from "@/db/schema";

export interface ReadingRepository {
  get(chapterId: string): Promise<ReadingRecord | undefined>;
  getAll(): Promise<ReadingRecord[]>;
  /** Persists lastPage and raises maxPageReached monotonically. */
  savePosition(chapterId: string, page: number, totalPages: number): Promise<void>;
}

// TODO(Sprint 2): implement ReadingRepository against src/db/database.ts.
export type { ReadingRecord };
