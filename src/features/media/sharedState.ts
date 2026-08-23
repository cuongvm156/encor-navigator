/**
 * Sprint 6A.1 — keeps the two renditions of one MediaTrack in sync.
 *
 * Audio and video are two exports of the SAME lesson, so:
 * - progress is stored once, as a ratio, in `mediaTrackStates`
 * - the legacy `playbackStates` row of the audio rendition is mirrored so the
 *   existing AudioController resume path keeps working unchanged
 *
 * Nothing here writes reading progress, notes or bookmarks.
 */

import { mediaTrackStatesRepository } from "@/repositories/mediaTrackStatesRepository";
import { playbackRepository } from "@/repositories/playbackRepository";

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export interface SyncInput {
  chapterId: string;
  trackId: string;
  currentTime: number;
  duration: number;
  playbackRate?: number;
}

/** Called from the audio screen: shared state follows the audio playhead. */
export async function syncFromAudio(input: SyncInput): Promise<void> {
  if (!(input.duration > 0)) return;
  await mediaTrackStatesRepository.update({
    chapterId: input.chapterId,
    trackId: input.trackId,
    currentMode: "audio",
    resumeRatio: clamp01(input.currentTime / input.duration),
    audioDuration: input.duration,
    ...(input.playbackRate ? { playbackRate: input.playbackRate } : {}),
  });
}

export interface VideoSyncInput extends SyncInput {
  /** Audio rendition identity, so the audio resume point follows the video. */
  audioResourceId?: string;
}

/**
 * Called from the video player: shared state follows the video playhead and the
 * equivalent audio position is mirrored into `playbackStates`
 * (`audioTime = ratio * audioDuration`). `maxPosition` stays monotonic, so
 * watching after listening never lowers or double-counts progress.
 */
export async function syncFromVideo(input: VideoSyncInput): Promise<void> {
  if (!(input.duration > 0)) return;
  const ratio = clamp01(input.currentTime / input.duration);
  const state = await mediaTrackStatesRepository.update({
    chapterId: input.chapterId,
    trackId: input.trackId,
    currentMode: "video",
    resumeRatio: ratio,
    videoDuration: input.duration,
    ...(input.playbackRate ? { playbackRate: input.playbackRate } : {}),
  });

  const audioDuration = state?.audioDuration;
  if (!input.audioResourceId || !audioDuration || audioDuration <= 0) return;
  await playbackRepository.updatePosition(
    input.chapterId,
    input.audioResourceId,
    ratio * audioDuration,
    audioDuration,
  );
}

/** Resume seconds for a rendition of `duration` seconds, from shared state. */
export const resumeSeconds = (resumeRatio: number | undefined, duration: number): number =>
  resumeRatio && duration > 0 ? clamp01(resumeRatio) * duration : 0;
