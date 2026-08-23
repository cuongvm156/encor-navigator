/**
 * React binding for the shared AudioController.
 *
 * UI  ->  useAudioPlayer  ->  AudioController  ->  HTMLAudioElement
 * Route components must never touch HTMLAudioElement directly.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AUDIO_SKIP_SECONDS, audioController } from "./AudioController";
import { playbackPersistence } from "./playbackPersistence";
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
  const resourceId = source?.resourceId;

  // Browser-only persistence bridge: playback state <-> playbackRepository.
  useEffect(() => {
    playbackPersistence.start();
  }, []);

  useEffect(() => {
    if (!chapterId || !resourceId) return;
    audioController.load({
      chapterId,
      resourceId,
      title: source?.title ?? "Chapter audio",
      ...(src ? { src } : {}),
    });
  }, [chapterId, resourceId, src, source?.title]);

  const play = useCallback(() => void audioController.play(), []);
  const pause = useCallback(() => audioController.pause(), []);
  const togglePlayPause = useCallback(() => audioController.togglePlayPause(), []);
  const seekTo = useCallback((seconds: number) => {
    audioController.seekTo(seconds);
    playbackPersistence.saveSoon();
  }, []);
  const seekBy = useCallback((delta: number) => {
    audioController.seekBy(delta);
    playbackPersistence.saveSoon();
  }, []);
  const skipBack = useCallback(() => seekBy(-AUDIO_SKIP_SECONDS), [seekBy]);
  const skipForward = useCallback(() => seekBy(AUDIO_SKIP_SECONDS), [seekBy]);
  const setPlaybackRate = useCallback((rate: PlaybackRate) => {
    audioController.setPlaybackRate(rate);
    void playbackPersistence.savePlaybackRate(rate);
  }, []);

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
