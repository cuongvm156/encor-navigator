/**
 * Sprint 6A.1 — chapter Media progress from shared MediaTrack state.
 *
 * The overall weighting is unchanged (Reading 60% / Media 40%); this module
 * only produces the Media portion. A track completed through EITHER rendition
 * counts once, because `maxRatio` is shared.
 *
 * Weighting across tracks is duration-weighted when real durations are known.
 * Unknown durations never invent a value — such tracks are averaged unweighted
 * only among themselves when no measured duration exists at all.
 */

import type { MediaTrackState } from "@/db/schema";
import { getMediaTracks, type MediaTrack } from "@/data/resourceManifest";

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/** Best measured duration for a track, or undefined when nothing is measured. */
export function measuredDuration(state: MediaTrackState | undefined): number | undefined {
  if (!state) return undefined;
  const durations = [state.videoDuration, state.audioDuration].filter(
    (value): value is number => typeof value === "number" && value > 0,
  );
  return durations.length > 0 ? Math.max(...durations) : undefined;
}

/**
 * Media ratio of a chapter (0..1). Chapters with no declared track return 0 —
 * no progress is ever estimated for content that does not exist.
 *
 * Deterministic duration rule:
 * - EVERY declared track of the chapter has a measured duration (audio or
 *   video, whichever is larger) -> duration-weighted mean of `maxRatio`;
 * - otherwise (any track has never been loaded on this device) -> unweighted
 *   mean of `maxRatio` over ALL declared tracks. No duration is ever invented
 *   and an unplayed track always contributes 0.
 */
export function chapterMediaRatio(
  chapterId: string,
  states: MediaTrackState[],
  /** Track list override (tests inject fixtures instead of the manifest). */
  tracks: MediaTrack[] = getMediaTracks(chapterId),
): number {
  if (tracks.length === 0) return 0;

  const rows = tracks.map((track) => ({
    track,
    state: states.find((s) => s.chapterId === chapterId && s.trackId === track.trackId),
  }));

  const weighted = rows
    .map((row) => ({ ratio: clamp01(row.state?.maxRatio ?? 0), weight: measuredDuration(row.state) }))
    .filter((row): row is { ratio: number; weight: number } => typeof row.weight === "number");

  if (weighted.length === tracks.length && weighted.length > 0) {
    const total = weighted.reduce((sum, row) => sum + row.weight, 0);
    if (total > 0) {
      return clamp01(weighted.reduce((sum, row) => sum + row.ratio * row.weight, 0) / total);
    }
  }

  // Mixed / unknown durations: plain average over declared tracks. No fake
  // duration is introduced for tracks whose media has never been loaded.
  const sum = rows.reduce((total, row) => total + clamp01(row.state?.maxRatio ?? 0), 0);
  return clamp01(sum / tracks.length);
}

export function mediaRatiosByChapter(
  chapterIds: string[],
  states: MediaTrackState[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const chapterId of chapterIds) map[chapterId] = chapterMediaRatio(chapterId, states);
  return map;
}
