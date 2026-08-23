/**
 * React binding for the shared AudioController.
 *
 * UI  ->  useAudioPlayer  ->  AudioController  ->  HTMLAudioElement
 * Route components must never touch HTMLAudioElement directly.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AUDIO_SKIP_SECONDS, audioController } from "./AudioController";
import type { AudioPlayerState, AudioSource, PlaybackRate } from "./types";

const SERVER_STATE: AudioPlayerState = {
  source: undefined,
  isLoaded: false,
  isLoading: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  ended: false,
  error: undefined,
};

export function useAudioPlayer(source?: AudioSource) {
  const state = useSyncExternalStore(
    (listener) => audioController.subscribe(listener),
    () => audioController.getState(),
    () => SERVER_STATE,
  );

  const src = source?.src;
  const chapterId = source?.chapterId;

  useEffect(() => {
    if (!chapterId) return;
    audioController.load({
      chapterId,
      title: source?.title ?? "Chapter audio",
      ...(src ? { src } : {}),
    });
  }, [chapterId, src, source?.title]);

  const play = useCallback(() => void audioController.play(), []);
  const pause = useCallback(() => audioController.pause(), []);
  const togglePlayPause = useCallback(() => audioController.togglePlayPause(), []);
  const seekTo = useCallback((seconds: number) => audioController.seekTo(seconds), []);
  const seekBy = useCallback((delta: number) => audioController.seekBy(delta), []);
  const skipBack = useCallback(() => audioController.seekBy(-AUDIO_SKIP_SECONDS), []);
  const skipForward = useCallback(() => audioController.seekBy(AUDIO_SKIP_SECONDS), []);
  const setPlaybackRate = useCallback(
    (rate: PlaybackRate) => audioController.setPlaybackRate(rate),
    [],
  );

  return {
    ...state,
    play,
    pause,
    togglePlayPause,
    seekTo,
    seekBy,
    skipBack,
    skipForward,
    setPlaybackRate,
  };
}
