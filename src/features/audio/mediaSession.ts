/**
 * Media Session boundary — Sprint 2D.
 *
 * Thin, defensive wrapper around `navigator.mediaSession`. It NEVER owns audio
 * state: every action handler is supplied by the audio feature and ultimately
 * runs through `AudioController` / `useAudioPlayer`, so Sprint 2C persistence
 * keeps working unchanged.
 *
 * Every call is feature-detected and wrapped in try/catch: a browser that lacks
 * an action (iOS Safari notably rejects some) must never break playback.
 *
 * Real iPhone lock-screen behaviour can only be verified on a device.
 */

import type { AudioTrackMeta } from "./types";

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onSeekBackward?: (seconds: number) => void;
  onSeekForward?: (seconds: number) => void;
  onSeekTo?: (seconds: number) => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
}

export interface MediaPositionInfo {
  duration: number;
  position: number;
  playbackRate: number;
}

export const MEDIA_SESSION_SEEK_SECONDS = 15;

type MediaSessionLike = {
  metadata: unknown;
  playbackState: "none" | "paused" | "playing";
  setActionHandler: (action: string, handler: ((details: any) => void) | null) => void;
  setPositionState?: (state?: { duration: number; position: number; playbackRate: number }) => void;
};

const ACTIONS = [
  "play",
  "pause",
  "seekbackward",
  "seekforward",
  "seekto",
  "previoustrack",
  "nexttrack",
] as const;

export function isMediaSessionSupported(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

function session(): MediaSessionLike | undefined {
  if (!isMediaSessionSupported()) return undefined;
  return (navigator as unknown as { mediaSession: MediaSessionLike }).mediaSession;
}

/** Registers handlers; unsupported actions are skipped silently. */
export function setMediaSessionHandlers(handlers: MediaSessionHandlers): void {
  const ms = session();
  if (!ms) return;

  const map: Record<(typeof ACTIONS)[number], ((details: any) => void) | null> = {
    play: handlers.onPlay ? () => handlers.onPlay?.() : null,
    pause: handlers.onPause ? () => handlers.onPause?.() : null,
    seekbackward: handlers.onSeekBackward
      ? (details) =>
          handlers.onSeekBackward?.(
            Number(details?.seekOffset) > 0 ? Number(details.seekOffset) : MEDIA_SESSION_SEEK_SECONDS,
          )
      : null,
    seekforward: handlers.onSeekForward
      ? (details) =>
          handlers.onSeekForward?.(
            Number(details?.seekOffset) > 0 ? Number(details.seekOffset) : MEDIA_SESSION_SEEK_SECONDS,
          )
      : null,
    seekto: handlers.onSeekTo
      ? (details) => {
          const time = Number(details?.seekTime);
          if (Number.isFinite(time)) handlers.onSeekTo?.(time);
        }
      : null,
    previoustrack: handlers.onPreviousTrack ? () => handlers.onPreviousTrack?.() : null,
    nexttrack: handlers.onNextTrack ? () => handlers.onNextTrack?.() : null,
  };

  for (const action of ACTIONS) {
    try {
      ms.setActionHandler(action, map[action]);
    } catch {
      // Action unsupported by this browser — ignore, playback is unaffected.
    }
  }
}

/** Clears every handler we may have registered (avoids stale references). */
export function clearMediaSessionHandlers(): void {
  const ms = session();
  if (!ms) return;
  for (const action of ACTIONS) {
    try {
      ms.setActionHandler(action, null);
    } catch {
      /* ignore */
    }
  }
}

/** Publishes track metadata for the lock screen. Artwork is optional. */
export function setMediaMetadata(meta: AudioTrackMeta | undefined): void {
  const ms = session();
  if (!ms) return;
  try {
    if (!meta) {
      ms.metadata = null;
      return;
    }
    const MediaMetadataCtor = (globalThis as unknown as { MediaMetadata?: any }).MediaMetadata;
    if (!MediaMetadataCtor) return;
    ms.metadata = new MediaMetadataCtor({
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      ...(meta.artworkUrl
        ? { artwork: [{ src: meta.artworkUrl, sizes: "512x512", type: "image/png" }] }
        : {}),
    });
  } catch {
    /* metadata is best-effort */
  }
}

export function setMediaPlaybackState(state: "none" | "paused" | "playing"): void {
  const ms = session();
  if (!ms) return;
  try {
    ms.playbackState = state;
  } catch {
    /* ignore */
  }
}

/** Position uses the real element `currentTime` — never `maxPosition`. */
export function setMediaPositionState(info: MediaPositionInfo | undefined): void {
  const ms = session();
  if (!ms || typeof ms.setPositionState !== "function") return;
  try {
    if (!info || !Number.isFinite(info.duration) || info.duration <= 0) {
      ms.setPositionState();
      return;
    }
    const position = Math.min(Math.max(info.position, 0), info.duration);
    const playbackRate = info.playbackRate > 0 ? info.playbackRate : 1;
    ms.setPositionState({ duration: info.duration, position, playbackRate });
  } catch {
    /* Safari can throw on out-of-range values — never fatal. */
  }
}

export type { AudioTrackMeta };
