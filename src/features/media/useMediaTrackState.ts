/**
 * Sprint 6A.1 — React access to shared MediaTrack state.
 *
 * The state is rendition-independent (ratios), so switching between the MP3 and
 * the MP4 of the same logical track resumes at the same point and never
 * double-counts progress.
 */

import { useCallback, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import type { MediaTrackState } from "@/db/schema";
import {
  mediaTrackKey,
  mediaTrackStatesRepository,
  type MediaTrackUpdate,
} from "@/repositories/mediaTrackStatesRepository";
import { playbackRepository } from "@/repositories/playbackRepository";

const EMPTY: MediaTrackState[] = [];

/** All shared MediaTrack rows, live. */
export function useMediaTrackStates(): MediaTrackState[] {
  const rows = useLiveQuery(() => mediaTrackStatesRepository.getAll(), [], undefined);
  return rows ?? EMPTY;
}

export interface UseMediaTrackState {
  state: MediaTrackState | undefined;
  save: (update: Omit<MediaTrackUpdate, "chapterId" | "trackId">) => void;
}

/**
 * Reads one track's shared state and lazily seeds it from the legacy
 * `playbackState` the AudioController already maintains — a migration that only
 * ever ADDS a row and never rewrites playback, reading, note or bookmark data.
 */
export function useMediaTrackState(
  chapterId: string | undefined,
  trackId: string | undefined,
  legacyAudioResourceId?: string,
): UseMediaTrackState {
  const rows = useMediaTrackStates();
  const state = useMemo(
    () =>
      chapterId && trackId
        ? rows.find((row) => row.id === mediaTrackKey(chapterId, trackId))
        : undefined,
    [rows, chapterId, trackId],
  );

  useEffect(() => {
    if (!chapterId || !trackId || state || !legacyAudioResourceId) return;
    let cancelled = false;
    void playbackRepository.get(chapterId, legacyAudioResourceId).then((legacy) => {
      if (cancelled || !legacy || !(legacy.duration > 0)) return;
      void mediaTrackStatesRepository.seedIfMissing(chapterId, trackId, {
        resumeRatio: legacy.currentTime / legacy.duration,
        maxRatio: legacy.maxPosition / legacy.duration,
        audioDuration: legacy.duration,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [chapterId, trackId, state, legacyAudioResourceId]);

  const save = useCallback(
    (update: Omit<MediaTrackUpdate, "chapterId" | "trackId">) => {
      if (!chapterId || !trackId) return;
      void mediaTrackStatesRepository.update({ chapterId, trackId, ...update });
    },
    [chapterId, trackId],
  );

  return { state, save };
}
