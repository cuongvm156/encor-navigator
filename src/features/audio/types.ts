/**
 * Audio feature types (skeleton — Sprint 2 will implement the runtime).
 * No playback logic lives here.
 */

export type RepeatMode = "off" | "once" | "lesson";

export type SleepTimerOption = "off" | "15m" | "30m" | "45m" | "60m" | "end-of-track";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** A loadable audio track. `src` is empty/undefined when none is available. */
export interface AudioSource {
  chapterId: string;
  /** Stable resource identity used for persistence (never the media URL). */
  resourceId: string;
  title: string;
  /** Absolute or app-relative media URL. No copyrighted media is committed. */
  src?: string;
}

/**
 * Transient player/UI runtime state.
 * Distinct from the persisted `PlaybackState` in `src/db/schema.ts`.
 */
export interface AudioRuntimeState {
  source: AudioSource | undefined;
  isLoaded: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  /** Seconds. */
  currentTime: number;
  /** Seconds; 0 until metadata loads. */
  duration: number;
  playbackRate: PlaybackRate;
  ended: boolean;
  error: string | undefined;
}

/** Alias used by the controller/hook for clarity. */
export type AudioPlayerState = AudioRuntimeState;

/** Metadata handed to the Media Session API for lock-screen display (later sprint). */
export interface AudioTrackMeta {
  chapterId: string;
  title: string;
  album: string;
  artist: string;
  artworkUrl?: string;
  src: string;
}

/** Contract the UI may depend on, via `useAudioPlayer`. */
export interface AudioControllerApi {
  load(source: AudioSource | undefined): void;
  play(): Promise<void>;
  pause(): void;
  togglePlayPause(): void;
  seekTo(seconds: number): void;
  seekBy(deltaSeconds: number): void;
  setPlaybackRate(rate: PlaybackRate): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}
