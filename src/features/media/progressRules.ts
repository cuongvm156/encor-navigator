/**
 * Sprint 6A.1 — pure shared-progress rules (no Dexie, no browser APIs).
 *
 * `maxRatio` is the ONLY media progress measure of a logical MediaTrack and is
 * monotonic: listening to the MP3 and then watching the MP4 of the same track
 * can never count twice and can never lower progress.
 */

export const clamp01 = (n: number) =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

/** Monotonic merge of the shared progress measure. */
export const mergeMaxRatio = (existing: number | undefined, incoming: number): number =>
  Math.max(clamp01(existing ?? 0), clamp01(incoming));

/** Resume seconds for a rendition: `resumeRatio * duration of THIS rendition`. */
export const renditionResumeSeconds = (
  resumeRatio: number | undefined,
  duration: number,
): number => (resumeRatio && duration > 0 ? clamp01(resumeRatio) * duration : 0);
