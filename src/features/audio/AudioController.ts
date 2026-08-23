/**
 * AudioController — placeholder.
 *
 * Sprint 2 will implement this on top of a single shared `HTMLAudioElement`.
 * Web Audio API and third-party player libraries are NOT approved.
 *
 * Responsibilities (future):
 * - own one HTMLAudioElement instance for the whole app
 * - expose play/pause/seek/skip/rate/repeat
 * - emit timeupdate so repositories can persist currentTime + maxPosition
 * - hand track metadata to `mediaSession.ts` for lock-screen controls
 *
 * It must never talk to IndexedDB directly — persistence goes through
 * `src/repositories/playbackRepository.ts`.
 */

import type { AudioControllerApi } from "./types";

// TODO(Sprint 2): implement using HTMLAudioElement.
export type { AudioControllerApi };

export const AUDIO_SKIP_SECONDS = 15;
