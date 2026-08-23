/**
 * Playback repository — the only access layer to the `playbackStates` table.
 *
 * Progress uses `maxPosition`; resume uses `currentTime`. Seeking backward never
 * lowers `maxPosition`.
 */

import { getDb } from "@/db/database";
import { resourceKey, type PlaybackState, type RepeatMode } from "@/db/schema";

const now = () => new Date().toISOString();

export const playbackRepository = {
  async getByChapter(chapterId: string): Promise<PlaybackState[]> {
    const db = getDb();
    if (!db) return [];
    return db.playbackStates.where("chapterId").equals(chapterId).toArray();
  },

  async getByResource(
    chapterId: string,
    resourceId: string,
  ): Promise<PlaybackState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    return db.playbackStates.get(resourceKey(chapterId, resourceId));
  },

  async getAll(): Promise<PlaybackState[]> {
    const db = getDb();
    if (!db) return [];
    return db.playbackStates.toArray();
  },

  /** Upsert a full record; `maxPosition` is kept monotonic. */
  async save(state: PlaybackState): Promise<PlaybackState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const existing = await db.playbackStates.get(state.id);
    const next: PlaybackState = {
      ...state,
      maxPosition: Math.max(state.maxPosition, existing?.maxPosition ?? 0),
      updatedAt: now(),
    };
    await db.playbackStates.put(next);
    return next;
  },

  /** Records a playhead move: `currentTime` follows, `maxPosition` only grows. */
  async updatePosition(
    chapterId: string,
    resourceId: string,
    currentTime: number,
    duration: number,
  ): Promise<PlaybackState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const id = resourceKey(chapterId, resourceId);
    const existing = await db.playbackStates.get(id);
    const next: PlaybackState = {
      id,
      chapterId,
      resourceId,
      currentTime,
      maxPosition: Math.max(currentTime, existing?.maxPosition ?? 0),
      duration: duration || existing?.duration || 0,
      playbackRate: existing?.playbackRate ?? 1,
      repeatMode: existing?.repeatMode ?? "off",
      updatedAt: now(),
    };
    await db.playbackStates.put(next);
    return next;
  },

  async savePreferences(
    chapterId: string,
    resourceId: string,
    prefs: { playbackRate?: number; repeatMode?: RepeatMode },
  ): Promise<PlaybackState | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const id = resourceKey(chapterId, resourceId);
    const existing = await db.playbackStates.get(id);
    if (existing) {
      // Patch only the preference fields so a concurrent position write is never
      // clobbered by a stale snapshot of currentTime / maxPosition.
      await db.playbackStates.update(id, {
        ...(prefs.playbackRate !== undefined ? { playbackRate: prefs.playbackRate } : {}),
        ...(prefs.repeatMode !== undefined ? { repeatMode: prefs.repeatMode } : {}),
        updatedAt: now(),
      });
      return db.playbackStates.get(id);
    }
    const next: PlaybackState = {
      id,
      chapterId,
      resourceId,
      currentTime: 0,
      maxPosition: 0,
      duration: 0,
      playbackRate: prefs.playbackRate ?? 1,
      repeatMode: prefs.repeatMode ?? "off",
      updatedAt: now(),
    };
    await db.playbackStates.put(next);
    return next;
  },

};

export type PlaybackRepository = typeof playbackRepository;
export type { PlaybackState };
