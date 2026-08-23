import type { Chapter, ChapterProgress, Part } from "@/features/course/types";

/**
 * Centralized progress weighting. A chapter is considered complete when the
 * reading portion (60%) and the resource portion (40%) are both done.
 * Change these two numbers to re-weight the whole app.
 */
export const PROGRESS_WEIGHTS = {
  reading: 0.6,
  resources: 0.4,
} as const;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function chapterCompletion(progress?: ChapterProgress): number {
  if (!progress) return 0;
  return clamp01(
    clamp01(progress.readRatio) * PROGRESS_WEIGHTS.reading +
      clamp01(progress.resourceRatio) * PROGRESS_WEIGHTS.resources,
  );
}

export function averageCompletion(
  chapters: Chapter[],
  progressById: Record<string, ChapterProgress>,
): number {
  if (chapters.length === 0) return 0;
  const total = chapters.reduce((sum, c) => sum + chapterCompletion(progressById[c.id]), 0);
  return total / chapters.length;
}

export function partCompletion(
  part: Part,
  chapters: Chapter[],
  progressById: Record<string, ChapterProgress>,
): number {
  return averageCompletion(
    chapters.filter((c) => c.partId === part.id),
    progressById,
  );
}

export const toPercent = (ratio: number) => Math.round(ratio * 100);

/** Reading portion of a chapter (0..1). */
export const readingRatioOf = (progress?: ChapterProgress) => clamp01(progress?.readRatio ?? 0);

/** Audio portion of a chapter (0..1). */
export const audioRatioOf = (progress?: ChapterProgress) =>
  clamp01(progress?.audioRatio ?? progress?.resourceRatio ?? 0);
