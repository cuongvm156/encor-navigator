/**
 * Progress repository — the only access layer to the `progress` table.
 *
 * Stores `readingRatio` and `audioRatio` independently. Overall completion is
 * always derived through the central weights in
 * `src/features/progress/weights.ts` (60% reading / 40% audio) — never
 * re-implemented here.
 *
 * `ChapterProgress.resourceRatio` in the demo data is a placeholder and is NOT
 * audio progress.
 */

import { getDb } from "@/db/database";
import type { ChapterStatusValue, ProgressRecord } from "@/db/schema";
import { chapterCompletion } from "@/features/progress/weights";

import { playbackRepository } from "./playbackRepository";
import { readingRepository } from "./readingRepository";

const now = () => new Date().toISOString();
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function statusFor(readingRatio: number, audioRatio: number): ChapterStatusValue {
  const overall = chapterCompletion({ readRatio: readingRatio, audioRatio });
  if (overall >= 1) return "completed";
  if (overall > 0) return "in_progress";
  return "not_started";
}

export const progressRepository = {
  async getByChapter(chapterId: string): Promise<ProgressRecord | undefined> {
    const db = getDb();
    if (!db) return undefined;
    return db.progress.get(chapterId);
  },

  async getAll(): Promise<ProgressRecord[]> {
    const db = getDb();
    if (!db) return [];
    return db.progress.toArray();
  },

  async save(record: ProgressRecord): Promise<ProgressRecord | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const next: ProgressRecord = { ...record, updatedAt: now() };
    await db.progress.put(next);
    return next;
  },

  /**
   * Recomputes and persists a chapter's stored ratios from the reading and
   * playback records. Reading = maxPageReached / totalPages,
   * audio = maxPosition / duration.
   */
  async recalculateChapter(chapterId: string): Promise<ProgressRecord | undefined> {
    const db = getDb();
    if (!db) return undefined;

    const [reading, playback] = await Promise.all([
      readingRepository.getByChapter(chapterId),
      playbackRepository.getByChapter(chapterId),
    ]);

    const ratio = (values: number[]) =>
      values.length === 0 ? 0 : clamp01(values.reduce((a, b) => a + b, 0) / values.length);

    const readingRatio = ratio(
      reading.filter((r) => r.totalPages > 0).map((r) => r.maxPageReached / r.totalPages),
    );
    const audioRatio = ratio(
      playback.filter((p) => p.duration > 0).map((p) => p.maxPosition / p.duration),
    );

    const next: ProgressRecord = {
      id: chapterId,
      chapterId,
      readingRatio,
      audioRatio,
      status: statusFor(readingRatio, audioRatio),
      updatedAt: now(),
    };
    await db.progress.put(next);
    return next;
  },

  /** Derived overall completion via the central 60/40 weighting. */
  overallOf(record?: ProgressRecord): number {
    if (!record) return 0;
    return chapterCompletion({
      readRatio: record.readingRatio,
      audioRatio: record.audioRatio,
    });
  },
};

export type ProgressRepository = typeof progressRepository;
export type { ProgressRecord };
