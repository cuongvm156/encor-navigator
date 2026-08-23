/**
 * Read-only view of persisted playback state for the Audio screen — Sprint 2C.
 *
 * UI must never touch Dexie directly, so this hook goes through
 * `playbackRepository`. It is browser-only and never writes.
 *
 * Progress uses `maxPosition`; resume/playhead uses `currentTime`.
 */

import { useCallback, useEffect, useState } from "react";
import { playbackRepository } from "@/repositories/playbackRepository";
import type { PlaybackState } from "@/db/schema";

const REFRESH_MS = 3000;

export type PlaybackStateMap = Record<string, PlaybackState>;

export const playbackKey = (chapterId: string, resourceId: string) => `${chapterId}:${resourceId}`;

export function usePersistedPlayback(): {
  states: PlaybackStateMap;
  refresh: () => void;
} {
  const [states, setStates] = useState<PlaybackStateMap>({});

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    void playbackRepository
      .getAll()
      .then((rows) => {
        const next: PlaybackStateMap = {};
        for (const row of rows) next[playbackKey(row.chapterId, row.resourceId)] = row;
        setStates(next);
      })
      .catch((error) => {
        console.warn("[audio-progress] could not read playback states", error);
      });
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { states, refresh };
}

/** Displayed audio progress: persisted furthest point over the real duration. */
export function audioProgressRatio(maxPosition: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(Math.max(maxPosition / duration, 0), 1);
}
