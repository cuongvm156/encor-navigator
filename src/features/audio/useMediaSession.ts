/**
 * React binding for the Media Session boundary — Sprint 2D.
 *
 * The Audio screen supplies the SAME actions it uses on-screen (player actions
 * from `useAudioPlayer`, and the Sprint 2C `selectAudioChapter` switching for
 * previous/next), so lock-screen controls can never diverge from in-app ones.
 */

import { useEffect, useRef } from "react";
import {
  clearMediaSessionHandlers,
  isMediaSessionSupported,
  setMediaMetadata,
  setMediaPlaybackState,
  setMediaPositionState,
  setMediaSessionHandlers,
  type MediaSessionHandlers,
} from "./mediaSession";

const POSITION_THROTTLE_MS = 4000;

export const MEDIA_ALBUM = "CCNP ENCOR 350-401";
export const MEDIA_ARTIST = "ENCOR Study";

interface UseMediaSessionOptions {
  /** Active chapter title shown on the lock screen. */
  title: string;
  isPlaying: boolean;
  hasSource: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  handlers: MediaSessionHandlers;
}

export function useMediaSession({
  title,
  isPlaying,
  hasSource,
  currentTime,
  duration,
  playbackRate,
  handlers,
}: UseMediaSessionOptions) {
  // Keep one stable handler registration; the ref avoids re-registering every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isMediaSessionSupported()) return;
    setMediaSessionHandlers({
      onPlay: () => handlersRef.current.onPlay?.(),
      onPause: () => handlersRef.current.onPause?.(),
      onSeekBackward: (s) => handlersRef.current.onSeekBackward?.(s),
      onSeekForward: (s) => handlersRef.current.onSeekForward?.(s),
      onSeekTo: (s) => handlersRef.current.onSeekTo?.(s),
      onPreviousTrack: () => handlersRef.current.onPreviousTrack?.(),
      onNextTrack: () => handlersRef.current.onNextTrack?.(),
    });
    return () => clearMediaSessionHandlers();
  }, []);

  // Metadata follows the active chapter; stale titles are not allowed.
  useEffect(() => {
    if (!isMediaSessionSupported()) return;
    setMediaMetadata(
      hasSource
        ? {
            chapterId: title,
            title,
            album: MEDIA_ALBUM,
            artist: MEDIA_ARTIST,
            src: "",
          }
        : undefined,
    );
  }, [title, hasSource]);

  // Real element state → system state.
  useEffect(() => {
    if (!isMediaSessionSupported()) return;
    setMediaPlaybackState(!hasSource ? "none" : isPlaying ? "playing" : "paused");
  }, [isPlaying, hasSource]);

  // Position state: currentTime (playhead), never maxPosition. Throttled.
  const lastPositionAt = useRef(0);
  useEffect(() => {
    if (!isMediaSessionSupported()) return;
    const now = Date.now();
    if (now - lastPositionAt.current < POSITION_THROTTLE_MS) return;
    lastPositionAt.current = now;
    setMediaPositionState(
      duration > 0 ? { duration, position: currentTime, playbackRate } : undefined,
    );
  }, [currentTime, duration, playbackRate]);

  // Rate / duration changes should publish immediately.
  useEffect(() => {
    if (!isMediaSessionSupported()) return;
    lastPositionAt.current = Date.now();
    setMediaPositionState(
      duration > 0 ? { duration, position: currentTime, playbackRate } : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, playbackRate, isPlaying]);
}
