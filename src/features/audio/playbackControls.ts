/**
 * Repeat modes + Sleep timer service — Sprint 2E.
 *
 * UI -> usePlaybackControls -> playbackControls -> AudioController -> the one
 * HTMLAudioElement. This module owns exactly ONE `ended` subscription and at
 * most ONE wall-clock interval for the whole app, so navigating between routes
 * (background playback) never duplicates timers or listeners.
 *
 * Rules:
 * - `repeatMode` is persisted per audio resource in `PlaybackState`.
 * - "Repeat once" consumption is transient runtime state (never persisted).
 * - The sleep timer uses absolute wall-clock expiry stored in the settings
 *   store, so rerenders and refreshes cannot reset it.
 * - End-of-track sleep timer takes priority over every repeat mode.
 */

import { playbackRepository } from "@/repositories/playbackRepository";
import { settingsRepository } from "@/repositories/settingsRepository";
import { audioController } from "./AudioController";
import { playbackPersistence } from "./playbackPersistence";
import type { AudioPlayerState, RepeatMode, SleepTimerOption } from "./types";

const SLEEP_SETTING_KEY = "audio.sleepTimer";
const TICK_MS = 1000;

const REPEAT_MODES: readonly RepeatMode[] = ["off", "once", "lesson"];
const SLEEP_MINUTES: Partial<Record<SleepTimerOption, number>> = {
  "15m": 15,
  "30m": 30,
  "45m": 45,
  "60m": 60,
};

/** Invalid stored values always fall back to "off". */
export const normalizeRepeatMode = (value: unknown): RepeatMode =>
  REPEAT_MODES.includes(value as RepeatMode) ? (value as RepeatMode) : "off";

const normalizeSleepOption = (value: unknown): SleepTimerOption =>
  value === "15m" || value === "30m" || value === "45m" || value === "60m" ||
  value === "end-of-track"
    ? value
    : "off";

export interface PlaybackControlsState {
  repeatMode: RepeatMode;
  sleepOption: SleepTimerOption;
  /** Absolute expiry (epoch ms) for time-based timers; undefined otherwise. */
  sleepExpiresAt: number | undefined;
  /** Remaining ms for time-based timers; undefined otherwise. */
  sleepRemainingMs: number | undefined;
}

const INITIAL: PlaybackControlsState = {
  repeatMode: "off",
  sleepOption: "off",
  sleepExpiresAt: undefined,
  sleepRemainingMs: undefined,
};

interface StoredSleep {
  option: SleepTimerOption;
  expiresAt?: number;
}

const isBrowser = () => typeof window !== "undefined";

const warn = (message: string, error: unknown) =>
  console.warn(`[audio-controls] ${message}`, error);

class PlaybackControls {
  private started = false;
  private state: PlaybackControlsState = INITIAL;
  private listeners = new Set<() => void>();

  private unsubscribeState: (() => void) | undefined;
  private unsubscribeEnded: (() => void) | undefined;
  private ticker: ReturnType<typeof setInterval> | undefined;

  private key: string | undefined;
  private chapterId: string | undefined;
  private resourceId: string | undefined;
  /** True once the one-time repeat has already been used for this cycle. */
  private onceConsumed = false;

  getState(): PlaybackControlsState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(patch: Partial<PlaybackControlsState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Idempotent, browser-only. Never registers a second listener/timer. */
  start(): void {
    if (this.started || !isBrowser()) return;
    this.started = true;

    this.unsubscribeState = audioController.subscribe(this.onAudioState);
    this.onAudioState(audioController.getState());
    this.unsubscribeEnded = audioController.onNativeEnded(this.onEnded);

    void this.restoreSleepTimer();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.unsubscribeState?.();
    this.unsubscribeEnded?.();
    this.unsubscribeState = undefined;
    this.unsubscribeEnded = undefined;
    this.clearTicker();
  }

  private clearTicker() {
    if (this.ticker !== undefined) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
  }

  // ---------------------------------------------------------------- repeat

  private onAudioState = (state: AudioPlayerState) => {
    const source = state.source;
    const nextKey =
      source?.chapterId && source.resourceId
        ? `${source.chapterId}:${source.resourceId}`
        : undefined;
    if (nextKey === this.key) return;

    this.key = nextKey;
    this.chapterId = source?.chapterId;
    this.resourceId = source?.resourceId;
    // Chapter switch resets the transient one-time repeat consumption.
    this.onceConsumed = false;
    this.setState({ repeatMode: "off" });
    void this.loadRepeatMode(nextKey);
  };

  private async loadRepeatMode(key: string | undefined): Promise<void> {
    const chapterId = this.chapterId;
    const resourceId = this.resourceId;
    if (!chapterId || !resourceId) return;
    try {
      const saved = await playbackRepository.getByResource(chapterId, resourceId);
      if (this.key !== key) return; // stale read
      this.setState({ repeatMode: normalizeRepeatMode(saved?.repeatMode) });
    } catch (error) {
      warn("could not restore repeat mode", error);
    }
  }

  setRepeatMode(mode: RepeatMode): void {
    const next = normalizeRepeatMode(mode);
    // A mode change always resets the one-time repeat consumption.
    this.onceConsumed = false;
    this.setState({ repeatMode: next });
    const chapterId = this.chapterId;
    const resourceId = this.resourceId;
    if (!chapterId || !resourceId) return;
    void playbackRepository
      .savePreferences(chapterId, resourceId, { repeatMode: next })
      .catch((error) => warn("could not persist repeat mode", error));
  }

  /** Called when the user manually restarts the track. */
  resetRepeatConsumption(): void {
    this.onceConsumed = false;
  }

  // ------------------------------------------------------------ sleep timer

  private async restoreSleepTimer(): Promise<void> {
    try {
      const stored = await settingsRepository.get<StoredSleep>(SLEEP_SETTING_KEY);
      if (!stored) return;
      const option = normalizeSleepOption(stored.option);
      if (option === "off") return;
      if (option === "end-of-track") {
        this.setState({ sleepOption: option, sleepExpiresAt: undefined });
        return;
      }
      const expiresAt = typeof stored.expiresAt === "number" ? stored.expiresAt : 0;
      if (expiresAt > Date.now()) {
        this.setState({
          sleepOption: option,
          sleepExpiresAt: expiresAt,
          sleepRemainingMs: expiresAt - Date.now(),
        });
        this.startTicker();
      } else {
        // Expired while the app was closed: clear it and leave audio paused.
        await this.clearSleepTimer();
      }
    } catch (error) {
      warn("could not restore sleep timer", error);
    }
  }

  private startTicker() {
    this.clearTicker();
    this.ticker = setInterval(this.onTick, TICK_MS);
  }

  private onTick = () => {
    const expiresAt = this.state.sleepExpiresAt;
    if (!expiresAt) {
      this.clearTicker();
      return;
    }
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      void this.expireSleepTimer();
      return;
    }
    this.setState({ sleepRemainingMs: remaining });
  };

  setSleepOption(option: SleepTimerOption): void {
    const next = normalizeSleepOption(option);
    this.clearTicker();

    if (next === "off") {
      this.setState({ sleepOption: "off", sleepExpiresAt: undefined, sleepRemainingMs: undefined });
      void settingsRepository
        .remove(SLEEP_SETTING_KEY)
        .catch((error) => warn("could not clear sleep timer", error));
      return;
    }

    if (next === "end-of-track") {
      this.setState({
        sleepOption: next,
        sleepExpiresAt: undefined,
        sleepRemainingMs: undefined,
      });
      void settingsRepository
        .set(SLEEP_SETTING_KEY, { option: next } satisfies StoredSleep)
        .catch((error) => warn("could not persist sleep timer", error));
      return;
    }

    const minutes = SLEEP_MINUTES[next] ?? 0;
    const expiresAt = Date.now() + minutes * 60_000;
    this.setState({
      sleepOption: next,
      sleepExpiresAt: expiresAt,
      sleepRemainingMs: expiresAt - Date.now(),
    });
    void settingsRepository
      .set(SLEEP_SETTING_KEY, { option: next, expiresAt } satisfies StoredSleep)
      .catch((error) => warn("could not persist sleep timer", error));
    this.startTicker();
  }

  /** Stops playback, persists the position and clears the timer. */
  private async expireSleepTimer(): Promise<void> {
    this.clearTicker();
    audioController.pause();
    try {
      await playbackPersistence.flushNow();
    } catch (error) {
      warn("could not persist position at sleep-timer expiry", error);
    }
    await this.clearSleepTimer();
  }

  private async clearSleepTimer(): Promise<void> {
    this.clearTicker();
    this.setState({ sleepOption: "off", sleepExpiresAt: undefined, sleepRemainingMs: undefined });
    try {
      await settingsRepository.remove(SLEEP_SETTING_KEY);
    } catch (error) {
      warn("could not clear sleep timer", error);
    }
  }

  // -------------------------------------------------------------- end of track

  /**
   * Priority: sleep "end of track" > repeat once > repeat lesson > stop.
   * The position was already persisted by `playbackPersistence` on `ended`.
   */
  private onEnded = () => {
    if (this.state.sleepOption === "end-of-track") {
      audioController.pause();
      void this.clearSleepTimer();
      return;
    }

    if (this.state.repeatMode === "once") {
      if (this.onceConsumed) {
        this.onceConsumed = false; // cycle finished; do not loop again
        return;
      }
      this.onceConsumed = true;
      this.restartCurrentTrack();
      return;
    }

    if (this.state.repeatMode === "lesson") {
      this.restartCurrentTrack();
    }
    // "off": stay at the end, stopped.
  };

  /** Restart from 0. A rejected play() leaves the player paused, no retries. */
  private restartCurrentTrack(): void {
    audioController.seekTo(0);
    void audioController.play();
  }
}

export const playbackControls = new PlaybackControls();
export { SLEEP_SETTING_KEY };
