/**
 * Sprint 6A.1 — shared MediaTrack state repository.
 *
 * One logical learning item (MP3 + matching MP4) has ONE row here. Positions
 * are stored as ratios so a rendition switch maps cleanly:
 *   targetTime = resumeRatio * targetDuration
 *
 * `maxRatio` is monotonic — it never decreases — so consuming audio and then
 * video cannot double-count progress. Reading progress, notes, bookmarks and
 * the legacy `playbackStates` rows are never touched from here.
 */

import { getDb } from "@/db/database";
import type { MediaTrackState } from "@/db/schema";

const now = () => new Date().toISOString();
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export const mediaTrackKey = (chapterId: string, trackId: string) => `${chapterId}:${trackId}`;

export interface MediaTrackUpdate {
  chapterId: string;
  trackId: string;
  currentMode: "audio" | "video";
  /** Resume ratio 0..1 (also feeds maxRatio monotonically). */
  resumeRatio?: number;
  audioDuration?: number;
  videoDuration?: number;
  playbackRate?: number;
}

export const mediaTrackStatesRepository = {
  async getAll(): Promise<MediaTrackState[]> {
    const db = getDb();
    if (!db) return [];
    return db.mediaTrackStates.toArray();
  },

  async get(chapterId: string, trackId: string): Promise<MediaTrackState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    return db.mediaTrackStates.get(mediaTrackKey(chapterId, trackId));
  },

  /** Monotonic merge — `maxRatio` and measured durations are never lowered. */
  async update(input: MediaTrackUpdate): Promise<MediaTrackState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const id = mediaTrackKey(input.chapterId, input.trackId);
    const existing = await db.mediaTrackStates.get(id);
    const resumeRatio =
      input.resumeRatio === undefined ? (existing?.resumeRatio ?? 0) : clamp01(input.resumeRatio);
    const record: MediaTrackState = {
      ...existing,
      id,
      chapterId: input.chapterId,
      trackId: input.trackId,
      currentMode: input.currentMode,
      resumeRatio,
      maxRatio: Math.max(existing?.maxRatio ?? 0, resumeRatio),
      updatedAt: now(),
      ...(input.audioDuration && input.audioDuration > 0
        ? { audioDuration: input.audioDuration }
        : {}),
      ...(input.videoDuration && input.videoDuration > 0
        ? { videoDuration: input.videoDuration }
        : {}),
      ...(input.playbackRate ? { playbackRate: input.playbackRate } : {}),
    };
    await db.mediaTrackStates.put(record);
    return record;
  },

  /**
   * Creates the row only when it does not exist yet (lazy seeding from a legacy
   * `playbackState`). An existing row is returned untouched.
   */
  async seedIfMissing(
    chapterId: string,
    trackId: string,
    seed: { resumeRatio: number; maxRatio: number; audioDuration?: number },
  ): Promise<MediaTrackState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const id = mediaTrackKey(chapterId, trackId);
    const existing = await db.mediaTrackStates.get(id);
    if (existing) return existing;
    const record: MediaTrackState = {
      id,
      chapterId,
      trackId,
      currentMode: "audio",
      resumeRatio: clamp01(seed.resumeRatio),
      maxRatio: clamp01(Math.max(seed.maxRatio, seed.resumeRatio)),
      ...(seed.audioDuration && seed.audioDuration > 0
        ? { audioDuration: seed.audioDuration }
        : {}),
      updatedAt: now(),
    };
    await db.mediaTrackStates.put(record);
    return record;
  },

  /** Merge used by backup restore: forward-only, never clears. */
  async merge(incoming: MediaTrackState): Promise<"added" | "updated" | "unchanged"> {
    const db = getDb();
    if (!db) return "unchanged";
    const existing = await db.mediaTrackStates.get(incoming.id);
    if (!existing) {
      await db.mediaTrackStates.put(incoming);
      return "added";
    }
    const newer = Date.parse(incoming.updatedAt) > Date.parse(existing.updatedAt);
    const merged: MediaTrackState = {
      ...existing,
      maxRatio: Math.max(existing.maxRatio, clamp01(incoming.maxRatio)),
      resumeRatio: newer ? clamp01(incoming.resumeRatio) : existing.resumeRatio,
      currentMode: newer ? incoming.currentMode : existing.currentMode,
      audioDuration: existing.audioDuration ?? incoming.audioDuration,
      videoDuration: existing.videoDuration ?? incoming.videoDuration,
      updatedAt: newer ? incoming.updatedAt : existing.updatedAt,
    };
    const changed =
      merged.maxRatio !== existing.maxRatio ||
      merged.resumeRatio !== existing.resumeRatio ||
      merged.audioDuration !== existing.audioDuration ||
      merged.videoDuration !== existing.videoDuration;
    if (!changed) return "unchanged";
    await db.mediaTrackStates.put(merged);
    return "updated";
  },
};

export type MediaTrackStatesRepository = typeof mediaTrackStatesRepository;
