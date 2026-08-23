/**
 * React binding for the repeat / sleep-timer service — Sprint 2E.
 *
 * The service lives outside React so timers and the single `ended` listener
 * survive re-renders and route changes (background playback).
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { playbackControls, type PlaybackControlsState } from "./playbackControls";
import type { RepeatMode, SleepTimerOption } from "./types";

const SERVER_STATE: PlaybackControlsState = {
  repeatMode: "off",
  sleepOption: "off",
  sleepExpiresAt: undefined,
  sleepRemainingMs: undefined,
};

export function usePlaybackControls() {
  const state = useSyncExternalStore(
    (listener) => playbackControls.subscribe(listener),
    () => playbackControls.getState(),
    () => SERVER_STATE,
  );

  useEffect(() => {
    playbackControls.start();
  }, []);

  const setRepeatMode = useCallback(
    (mode: RepeatMode) => playbackControls.setRepeatMode(mode),
    [],
  );
  const setSleepOption = useCallback(
    (option: SleepTimerOption) => playbackControls.setSleepOption(option),
    [],
  );
  const resetRepeatConsumption = useCallback(
    () => playbackControls.resetRepeatConsumption(),
    [],
  );

  return { ...state, setRepeatMode, setSleepOption, resetRepeatConsumption };
}

/** "12:04" style remaining-time label for the sleep timer. */
export function formatRemaining(ms: number | undefined): string | undefined {
  if (ms === undefined || ms <= 0) return undefined;
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
