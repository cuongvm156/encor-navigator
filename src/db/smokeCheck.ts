/**
 * Developer-only smoke check for the local database invariants.
 *
 * Not wired to any UI. Run manually from the browser console:
 *   import("/src/db/smokeCheck.ts").then((m) => m.runDbSmokeCheck());
 *
 * Verifies:
 * - reading: lastPage follows the reader, maxPageReached never decreases
 * - audio:   currentTime follows the playhead, maxPosition never decreases
 *
 * Cleanup deletes ONLY the two records this check creates, by their exact ids.
 * Never use db.delete(), indexedDB.deleteDatabase() or table.clear() here.
 */

import { playbackRepository } from "@/repositories/playbackRepository";
import { readingRepository } from "@/repositories/readingRepository";

import { getDb, isBrowser } from "./database";
import { resourceKey } from "./schema";

export interface SmokeCheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

/** Stable ids used only by this smoke check. */
const SMOKE_CHAPTER_ID = "__smoke__";
const SMOKE_READING_RESOURCE_ID = "pdf";
const SMOKE_PLAYBACK_RESOURCE_ID = "mp3";
const SMOKE_READING_ID = resourceKey(SMOKE_CHAPTER_ID, SMOKE_READING_RESOURCE_ID);
const SMOKE_PLAYBACK_ID = resourceKey(SMOKE_CHAPTER_ID, SMOKE_PLAYBACK_RESOURCE_ID);

async function cleanupSmokeRecords(): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.readingStates.delete(SMOKE_READING_ID);
    await db.playbackStates.delete(SMOKE_PLAYBACK_ID);
  } catch (error) {
    console.error("[ENCORStudyDB] smoke check cleanup failed", error);
  }
}

export async function runDbSmokeCheck(): Promise<SmokeCheckResult[]> {
  if (!isBrowser()) {
    return [{ name: "environment", passed: false, detail: "not running in a browser" }];
  }

  const results: SmokeCheckResult[] = [];

  try {
    await readingRepository.updateProgress(
      SMOKE_CHAPTER_ID,
      SMOKE_READING_RESOURCE_ID,
      10,
      100,
    );
    await readingRepository.updateProgress(
      SMOKE_CHAPTER_ID,
      SMOKE_READING_RESOURCE_ID,
      20,
      100,
    );
    const readBack = await readingRepository.updateProgress(
      SMOKE_CHAPTER_ID,
      SMOKE_READING_RESOURCE_ID,
      5,
      100,
    );
    results.push({
      name: "reading monotonic maxPageReached",
      passed: readBack?.lastPage === 5 && readBack?.maxPageReached === 20,
      detail: `lastPage=${readBack?.lastPage} maxPageReached=${readBack?.maxPageReached}`,
    });

    await playbackRepository.updatePosition(
      SMOKE_CHAPTER_ID,
      SMOKE_PLAYBACK_RESOURCE_ID,
      600,
      1200,
    );
    const playBack = await playbackRepository.updatePosition(
      SMOKE_CHAPTER_ID,
      SMOKE_PLAYBACK_RESOURCE_ID,
      300,
      1200,
    );
    results.push({
      name: "audio monotonic maxPosition",
      passed: playBack?.currentTime === 300 && playBack?.maxPosition === 600,
      detail: `currentTime=${playBack?.currentTime} maxPosition=${playBack?.maxPosition}`,
    });
  } finally {
    await cleanupSmokeRecords();
  }

  return results;
}
