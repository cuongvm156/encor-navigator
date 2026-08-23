/**
 * Sprint 6A.1 fix — rendition switch coordination.
 *
 * Switching between the MP3 and the MP4 of one logical MediaTrack must:
 *   1. pause the rendition that is currently playing;
 *   2. flush its position so the shared ratio is up to date BEFORE leaving;
 *   3. let the target rendition seek to `resumeRatio * targetDuration` once its
 *      real metadata is known (done by the target player).
 *
 * Both renditions may never play at the same time. Nothing here autoplays: the
 * target may only start when it consumes the matching one-shot switch intent
 * from `switchIntent.ts` (armed exclusively by a user switch action while the
 * source was playing), and the browser may still refuse.
 */

import { audioController } from "@/features/audio/AudioController";
import { playbackPersistence } from "@/features/audio/playbackPersistence";
import { syncFromAudio } from "./sharedState";

export {
  clearRenditionSwitch,
  consumeRenditionSwitch,
  peekRenditionSwitch,
  requestRenditionSwitch,
  SWITCH_INTENT_TTL_MS,
  type RenditionMode,
  type SwitchIntent,
} from "./switchIntent";

export interface LeaveAudioInput {
  chapterId: string;
  trackId: string;
  currentTime: number;
  duration: number;
  playbackRate?: number;
}

/** Pauses + flushes the audio rendition. Returns true when it was playing. */
export async function leaveAudioRendition(input: LeaveAudioInput): Promise<boolean> {
  const wasPlaying = audioController.getState().isPlaying;
  audioController.pause();
  if (input.duration > 0) {
    await syncFromAudio({
      chapterId: input.chapterId,
      trackId: input.trackId,
      currentTime: input.currentTime,
      duration: input.duration,
      ...(input.playbackRate ? { playbackRate: input.playbackRate } : {}),
    });
  }
  try {
    await playbackPersistence.flushNow();
  } catch {
    // Persistence failures never block the switch.
  }
  return wasPlaying;
}

/** Pauses the video element and reports whether it was playing. */
export function leaveVideoRendition(video: HTMLVideoElement | null | undefined): boolean {
  if (!video) return false;
  const wasPlaying = !video.paused;
  video.pause();
  return wasPlaying;
}
