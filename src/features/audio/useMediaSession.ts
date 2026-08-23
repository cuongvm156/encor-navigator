/**
 * React binding for the Media Session boundary — Sprint 2D.
 *
 * The Audio screen supplies the SAME actions it uses on-screen (player actions
 * from `useAudioPlayer`, and the Sprint 2C `selectAudioChapter` switching for
 * previous/next), so lock-screen controls can never diverge from in-app ones.
 *
 * Metadata lifecycle: applied on chapter change, source change, metadata load,
 * playback start (native `play` event) and state restore. It is NEVER cleared
 * on pause, visibility change or re-render.
 */

import { useEffect, useRef } from "react";
import { audioController } from "./AudioController";
import {
  clearMediaSessionHandlers,
  isMediaSessionSupported,
  reapplyMediaSessionMetadata,
  setMediaPlaybackState,
  setMediaPositionState,
  setMediaSessionHandlers,
  updateMediaSessionMetadata,
  type MediaSessionHandlers,
} from "./mediaSession";

const POSITION_THROTTLE_MS = 4000;

export const MEDIA_ALBUM = "CCNP ENCOR 350-401";
export const MEDIA_ARTIST = "ENCOR Study";

interface UseMediaSessionOptions {
  /** Canonical active chapter id (same one driving the UI and the source). */
  chapterId: string;
  /** Active chapter title shown on the lock screen. */
  title: string;
  /** Resolved media URL of the active source ("" when unavailable). */
  src: string;
  isPlaying: boolean;
  isLoaded: boolean;
  hasSource: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  handlers: MediaSessionHandlers;
}

export function useMediaSession({
  chapterId,
  title,
  src,
  isPlaying,
  isLoaded,
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

  // Canonical metadata: chapter change, source change, metadata load, restore.
  const metaRef = useRef({ chapterId, title, src });
  metaRef.current = { chapterId, title, src };

  useEffect(() => {
    if (!isMediaSessionSupported() || !hasSource || !title) return;
    updateMediaSessionMetadata({
      chapterId,
      title,
      album: MEDIA_ALBUM,
      artist: MEDIA_ARTIST,
      src,
    });
  }, [chapterId, title, src, hasSource, isLoaded, isPlaying]);

  // iOS: Now Playing info often only surfaces once playback is actually active.
  useEffect(() => {
    if (!isMediaSessionSupported()) return;
    return audioController.onNativePlay(() => {
      const { chapterId: id, title: t, src: s } = metaRef.current;
      if (!t) {
        reapplyMediaSessionMetadata();
        return;
      }
      updateMediaSessionMetadata({
        chapterId: id,
        title: t,
        album: MEDIA_ALBUM,
        artist: MEDIA_ARTIST,
        src: s,
      });
      setMediaPlaybackState("playing");
    });
  }, []);

  // Real element state → system state. "none" is avoided during transitions.
  useEffect(() => {
    if (!isMediaSessionSupported()) return;
    setMediaPlaybackState(isPlaying ? "playing" : "paused");
  }, [isPlaying]);

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
