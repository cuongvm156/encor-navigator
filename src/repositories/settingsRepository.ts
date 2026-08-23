/**
 * Settings repository — the only access layer to the `settings` table.
 *
 * Used for small local preferences (e.g. the active sleep-timer expiration).
 * Never clears the database.
 */

import { getDb } from "@/db/database";
import type { SettingRecord } from "@/db/schema";

const now = () => new Date().toISOString();

export const settingsRepository = {
  async get<T>(key: string): Promise<T | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const row = await db.settings.get(key);
    return row ? (row.value as T) : undefined;
  },

  async set(key: string, value: unknown): Promise<void> {
    const db = getDb();
    if (!db) return;
    const record: SettingRecord = { key, value, updatedAt: now() };
    await db.settings.put(record);
  },

  /** Removes a single preference key. Never touches other stores. */
  async remove(key: string): Promise<void> {
    const db = getDb();
    if (!db) return;
    await db.settings.delete(key);
  },
};

export type SettingsRepository = typeof settingsRepository;
