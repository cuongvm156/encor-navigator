/**
 * Live course progress — Sprint 3C.1.
 *
 * Single source of truth for displayed progress: the persisted Dexie records.
 * Every screen (Dashboard, Learn, Chapter Detail, Progress, Reader) subscribes
 * through this hook, so percentages can never drift apart and update without a
 * refresh.
 *
 * Rules preserved:
 * - reading completion  = maxPageReached / totalPages   (monotonic)
 * - reading resume      = lastPage
 * - audio completion    = maxPosition / duration        (monotonic)
 * - audio resume        = currentTime
 * - reading state identity is `${chapterId}:${pdfResourceId}`
 * - no progress is estimated for unavailable resources
 */

import { useLiveQuery } from "dexie-react-hooks";

import type { PlaybackState, ReadingState } from "@/db/schema";
import { chapters } from "@/features/course/data";
import type { ChapterProgress } from "@/features/course/types";
import { playbackRepository } from "@/repositories/playbackRepository";
import { readingRepository } from "@/repositories/readingRepository";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export interface LiveProgress {
  progressById: Record<string, ChapterProgress>;
  readingStates: ReadingState[];
  playbackStates: PlaybackState[];
  ready: boolean;
}

function averageRatio(values: number[]): number {
  if (values.length === 0) return 0;
  return clamp01(values.reduce((a, b) => a + b, 0) / values.length);
}

export function buildProgressById(
  readingStates: ReadingState[],
  playbackStates: PlaybackState[],
): Record<string, ChapterProgress> {
  const map: Record<string, ChapterProgress> = {};

  for (const chapter of chapters) {
    const reading = readingStates.filter(
      (r) => r.chapterId === chapter.id && r.resourceId === chapter.pdfResourceId,
    );
    const playback = playbackStates.filter(
      (p) => p.chapterId === chapter.id && p.resourceId === chapter.audioResourceId,
    );

    const readRatio = averageRatio(
      reading.filter((r) => r.totalPages > 0).map((r) => r.maxPageReached / r.totalPages),
    );
    const audioRatio = averageRatio(
      playback.filter((p) => p.duration > 0).map((p) => p.maxPosition / p.duration),
    );

    const lastOpened = [...reading, ...playback]
      .map((row) => row.updatedAt)
      .sort()
      .pop();

    map[chapter.id] = {
      chapterId: chapter.id,
      readRatio,
      resourceRatio: 0,
      audioRatio,
      ...(lastOpened ? { lastOpened } : {}),
    };
  }

  return map;
}

/** Subscribes to Dexie via liveQuery through the repository layer. */
export function useLiveProgress(): LiveProgress {
  const readingStates = useLiveQuery(() => readingRepository.getAll(), [], undefined);
  const playbackStates = useLiveQuery(() => playbackRepository.getAll(), [], undefined);

  const reading = readingStates ?? [];
  const playback = playbackStates ?? [];

  return {
    progressById: buildProgressById(reading, playback),
    readingStates: reading,
    playbackStates: playback,
    ready: readingStates !== undefined && playbackStates !== undefined,
  };
}

/**
 * Most recently updated readable chapter, resolved from persisted reading
 * state. Falls back to the first chapter that has a PDF when no history exists.
 */
export function pickContinueReading(readingStates: ReadingState[]) {
  const readable = chapters.filter((c) => c.pdfUrl && c.pdfResourceId);
  const latest = [...readingStates]
    .filter((r) => readable.some((c) => c.id === r.chapterId && c.pdfResourceId === r.resourceId))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .pop();

  const chapter = latest
    ? (readable.find((c) => c.id === latest.chapterId) ?? readable[0])
    : readable[0];

  return { chapter: chapter ?? chapters[0]!, lastPage: latest?.lastPage ?? 1 };
}
