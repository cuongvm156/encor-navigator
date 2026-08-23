import type { Chapter, ChapterProgress } from "./types";
import { audioRatioOf, readingRatioOf } from "@/features/progress/weights";

/** Demo page count derived from chapter length — keeps demo data in one place. */
export const chapterPages = (chapter: Chapter) => Math.max(8, Math.round(chapter.minutes * 0.8));

/** Demo audio duration in seconds. */
export const chapterAudioSeconds = (chapter: Chapter) => chapter.minutes * 60;

export const lastPageOf = (chapter: Chapter, progress?: ChapterProgress) =>
  Math.max(1, Math.round(chapterPages(chapter) * readingRatioOf(progress)) || 1);

export const audioPositionOf = (chapter: Chapter, progress?: ChapterProgress) =>
  Math.round(chapterAudioSeconds(chapter) * audioRatioOf(progress));

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}
