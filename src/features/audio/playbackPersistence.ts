/**
 * Audio playback persistence service — Sprint 2C.
 *
 * UI -> useAudioPlayer -> playbackPersistence -> playbackRepository -> Dexie.
 *
 * This is the ONLY audio-side module allowed to talk to a repository; the route
 * components and `AudioController` stay storage-agnostic. Nothing here imports
 * Dexie directly, and no code path ever clears the database.
 *
 * Rules:
 * - resume uses `currentTime`; progress uses `maxPosition` (monotonic, enforced
 *   in the repository).
 * - writes are throttled (~5s while playing) plus flushed on pause, track
 *   change, end of track, visibility change and pagehide.
 * - identity is `chapterId` + `resourceId`, never the media URL.
 */

import { playbackRepository } from "@/repositories/playbackRepository";
import { audioController } from "./AudioController";
import { PLAYBACK_RATES, type AudioPlayerState, type PlaybackRate } from "./types";

const SAVE_INTERVAL_MS = 5000;

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

const normalizeRate = (rate: number | undefined): PlaybackRate =>
  (PLAYBACK_RATES as readonly number[]).includes(rate ?? NaN) ? (rate as PlaybackRate) : 1;

const warn = (message: string, error: unknown) => {
  // Persistence problems are non-fatal: playback must keep working.
  console.warn(`[audio-persistence] ${message}`, error);
};

class PlaybackPersistence {
  private started = false;
  private unsubscribe: (() => void) | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private seekTimer: ReturnType<typeof setTimeout> | undefined;

  private key: string | undefined;
  private chapterId: string | undefined;
  private resourceId: string | undefined;
  private restored = false;
  private lastState: AudioPlayerState | undefined;
  private lastSavedTime = -1;

  /** Idempotent; browser-only. */
  start(): void {
    if (this.started || !isBrowser()) return;
    this.started = true;

    this.unsubscribe = audioController.subscribe(this.onState);
    this.onState(audioController.getState());

    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("pagehide", this.onPageHide);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.clearTimer();
    if (isBrowser()) {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      window.removeEventListener("pagehide", this.onPageHide);
    }
  }

  private clearTimer() {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private onState = (state: AudioPlayerState) => {
    const prev = this.lastState;
    this.lastState = state;

    const source = state.source;
    const nextKey =
      source?.chapterId && source.resourceId
        ? `${source.chapterId}:${source.resourceId}`
        : undefined;

    // Track change — flush the previous track, then prepare the new one.
    if (nextKey !== this.key) {
      void this.flush(prev);
      this.key = nextKey;
      this.chapterId = source?.chapterId;
      this.resourceId = source?.resourceId;
      this.restored = false;
      this.lastSavedTime = -1;
    }

    // Restore once metadata (duration) is available.
    if (!this.restored && this.key && state.isLoaded && state.duration > 0) {
      this.restored = true;
      void this.restore(state.duration);
    }

    // Periodic saves only while playing.
    if (state.isPlaying && this.timer === undefined) {
      this.timer = setInterval(() => void this.save(), SAVE_INTERVAL_MS);
    } else if (!state.isPlaying && this.timer !== undefined) {
      this.clearTimer();
    }

    // Immediate save on pause and on end of track.
    if (prev?.isPlaying && !state.isPlaying) void this.save();
    if (!prev?.ended && state.ended) void this.save(state.duration);
  };

  private async restore(duration: number): Promise<void> {
    const chapterId = this.chapterId;
    const resourceId = this.resourceId;
    if (!chapterId || !resourceId) return;
    try {
      const saved = await playbackRepository.getByResource(chapterId, resourceId);
      if (!saved) return;
      // Guard against a stale track change while the read was in flight.
      if (this.chapterId !== chapterId || this.resourceId !== resourceId) return;

      audioController.setPlaybackRate(normalizeRate(saved.playbackRate));

      // Resume uses currentTime, never maxPosition.
      const resumeAt = Math.min(Math.max(saved.currentTime, 0), Math.max(duration - 0.5, 0));
      if (resumeAt > 0.5) audioController.seekTo(resumeAt);
    } catch (error) {
      warn("could not restore playback state", error);
    }
  }

  /** Persist the current playhead. `maxPosition` growth is handled by the repository. */
  private async save(overrideTime?: number): Promise<void> {
    const chapterId = this.chapterId;
    const resourceId = this.resourceId;
    const state = this.lastState;
    if (!chapterId || !resourceId || !state?.isLoaded) return;

    const currentTime = overrideTime ?? audioController.getCurrentTime();
    if (!Number.isFinite(currentTime)) return;
    if (Math.abs(currentTime - this.lastSavedTime) < 0.25) return;

    const duration = audioController.getDuration() || state.duration || 0;
    try {
      await playbackRepository.updatePosition(chapterId, resourceId, currentTime, duration);
      await playbackRepository.savePreferences(chapterId, resourceId, {
        playbackRate: state.playbackRate,
      });
      this.lastSavedTime = currentTime;
    } catch (error) {
      warn("could not save playback state", error);
    }
  }

  /** Flush the position of a track we are leaving. */
  private async flush(state: AudioPlayerState | undefined): Promise<void> {
    const chapterId = this.chapterId;
    const resourceId = this.resourceId;
    if (!chapterId || !resourceId || !state?.isLoaded) return;
    const currentTime = audioController.getCurrentTime();
    const duration = audioController.getDuration() || state.duration || 0;
    try {
      await playbackRepository.updatePosition(chapterId, resourceId, currentTime, duration);
    } catch (error) {
      warn("could not flush playback state", error);
    }
  }

  /** Persist the playback rate the moment the user changes it. */
  async savePlaybackRate(rate: PlaybackRate): Promise<void> {
    const chapterId = this.chapterId;
    const resourceId = this.resourceId;
    if (!chapterId || !resourceId) return;
    try {
      await playbackRepository.savePreferences(chapterId, resourceId, {
        playbackRate: normalizeRate(rate),
      });
    } catch (error) {
      warn("could not save playback rate", error);
    }
  }

  /** Debounced save used after a user seek (also captures backward seeks while paused). */
  saveSoon(): void {
    if (!isBrowser()) return;
    if (this.seekTimer !== undefined) clearTimeout(this.seekTimer);
    this.seekTimer = setTimeout(() => {
      this.seekTimer = undefined;
      void this.save();
    }, 400);
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === "hidden") void this.save();
  };

  private onPageHide = () => {
    void this.save();
  };
}

export const playbackPersistence = new PlaybackPersistence();
