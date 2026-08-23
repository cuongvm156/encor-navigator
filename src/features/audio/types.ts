/**
 * Audio feature types (skeleton — Sprint 2 will implement the runtime).
 * No playback logic lives here.
 */

export type RepeatMode = "off" | "once" | "lesson";

export type SleepTimerOption = "off" | "15m" | "30m" | "45m" | "60m" | "end-of-track";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/**
 * Transient player/UI runtime state for one chapter's audio track.
 * Distinct from the persisted `PlaybackState` in `src/db/schema.ts`.
 */
export interface AudioRuntimeState {
  chapterId: string;
  /** Resume point, seconds. */
  currentTime: number;
  /** Furthest position reached, seconds — this is the progress measure. */
  maxPosition: number;
  /** Track duration, seconds. */
  duration: number;
  playbackRate: PlaybackRate;
  repeatMode: RepeatMode;
  /** ISO timestamp. */
  updatedAt: string;
}

/** Metadata handed to the Media Session API for lock-screen display. */
export interface AudioTrackMeta {
  chapterId: string;
  title: string;
  album: string;
  artist: string;
  artworkUrl?: string;
  src: string;
}

/** Minimal contract the UI may depend on. Implementation lands in Sprint 2. */
export interface AudioControllerApi {
  load(track: AudioTrackMeta, resumeAt?: number): void;
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  skip(deltaSeconds: number): void;
  setRate(rate: PlaybackRate): void;
  setRepeatMode(mode: RepeatMode): void;
  destroy(): void;
}
