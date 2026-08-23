/**
 * Reading repository — the only access layer to the `readingStates` table.
 *
 * Progress uses `maxPageReached`; resume uses `lastPage`. Paging backward never
 * lowers `maxPageReached`.
 */

import { getDb } from "@/db/database";
import { resourceKey, type ReadingState } from "@/db/schema";

const now = () => new Date().toISOString();

export const readingRepository = {
  async getByChapter(chapterId: string): Promise<ReadingState[]> {
    const db = getDb();
    if (!db) return [];
    return db.readingStates.where("chapterId").equals(chapterId).toArray();
  },

  async getByResource(
    chapterId: string,
    resourceId: string,
  ): Promise<ReadingState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    return db.readingStates.get(resourceKey(chapterId, resourceId));
  },

  async getAll(): Promise<ReadingState[]> {
    const db = getDb();
    if (!db) return [];
    return db.readingStates.toArray();
  },

  /** Upsert a full record; `maxPageReached` is kept monotonic. */
  async save(state: ReadingState): Promise<ReadingState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const existing = await db.readingStates.get(state.id);
    const next: ReadingState = {
      ...state,
      maxPageReached: Math.max(state.maxPageReached, existing?.maxPageReached ?? 0),
      updatedAt: now(),
    };
    await db.readingStates.put(next);
    return next;
  },

  /**
   * Records a page turn: `lastPage` follows the reader, `maxPageReached` only
   * ever grows.
   */
  async updateProgress(
    chapterId: string,
    resourceId: string,
    page: number,
    totalPages: number,
  ): Promise<ReadingState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const id = resourceKey(chapterId, resourceId);
    const existing = await db.readingStates.get(id);
    const next: ReadingState = {
      id,
      chapterId,
      resourceId,
      lastPage: page,
      maxPageReached: Math.max(page, existing?.maxPageReached ?? 0),
      totalPages: totalPages || existing?.totalPages || 0,
      updatedAt: now(),
    };
    await db.readingStates.put(next);
    return next;
  },
};

export type ReadingRepository = typeof readingRepository;
export type { ReadingState };
