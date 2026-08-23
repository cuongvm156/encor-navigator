/**
 * Media Session boundary — placeholder.
 *
 * Sprint 2 will use the Media Session API to publish track metadata and
 * register action handlers (play, pause, seekbackward, seekforward,
 * previoustrack, nexttrack) so iPhone lock-screen controls work.
 *
 * Nothing here is implemented yet, and lock-screen playback must never be
 * claimed as verified unless it was tested on a real iPhone.
 */

import type { AudioTrackMeta } from "./types";

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onSeekBackward?: (seconds: number) => void;
  onSeekForward?: (seconds: number) => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
}

// TODO(Sprint 2): set navigator.mediaSession.metadata from AudioTrackMeta.
export type { AudioTrackMeta };
