/**
 * Progress repository — placeholder contract.
 *
 * Combines reading + playback records into chapter/part/course completion using
 * the central weights in `src/features/progress/weights.ts` (60% reading /
 * 40% audio). It must not re-implement the weighting.
 *
 * Note: `ChapterProgress.resourceRatio` in the current demo data is a
 * placeholder and must NOT be treated as real audio progress in Sprint 2.
 */

import type { ChapterProgress } from "@/features/course/types";

export interface ProgressRepository {
  /** Derived, read-only view keyed by chapterId. */
  getChapterProgress(): Promise<Record<string, ChapterProgress>>;
  /** Full export for Backup / Restore. */
  exportAll(): Promise<unknown>;
  importAll(payload: unknown): Promise<void>;
}

// TODO(Sprint 2): implement ProgressRepository on top of the reading + playback repositories.
export type { ChapterProgress };
