/**
 * Playback repository — placeholder contract.
 *
 * Owns audio playback position. Progress uses `maxPosition`; resume uses
 * `currentTime`. Implementation (Dexie) lands in Sprint 2.
 */

import type { PlaybackRecord } from "@/db/schema";

export interface PlaybackRepository {
  get(chapterId: string): Promise<PlaybackRecord | undefined>;
  getAll(): Promise<PlaybackRecord[]>;
  /** Persists currentTime and raises maxPosition monotonically. */
  savePosition(chapterId: string, currentTime: number, duration: number): Promise<void>;
  savePreferences(
    chapterId: string,
    prefs: Partial<Pick<PlaybackRecord, "playbackRate" | "repeatMode">>,
  ): Promise<void>;
}

// TODO(Sprint 2): implement PlaybackRepository against src/db/database.ts.
export type { PlaybackRecord };
