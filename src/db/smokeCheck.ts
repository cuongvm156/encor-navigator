/**
 * Developer-only smoke check for the local database invariants.
 *
 * Not wired to any UI. Run manually from the browser console:
 *   import("/src/db/smokeCheck.ts").then((m) => m.runDbSmokeCheck());
 *
 * Verifies:
 * - reading: lastPage follows the reader, maxPageReached never decreases
 * - audio:   currentTime follows the playhead, maxPosition never decreases
 */

import { playbackRepository } from "@/repositories/playbackRepository";
import { readingRepository } from "@/repositories/readingRepository";

import { isBrowser } from "./database";

export interface SmokeCheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export async function runDbSmokeCheck(): Promise<SmokeCheckResult[]> {
  if (!isBrowser()) {
    return [{ name: "environment", passed: false, detail: "not running in a browser" }];
  }

  const chapterId = "__smoke__";
  const results: SmokeCheckResult[] = [];

  await readingRepository.updateProgress(chapterId, "pdf", 10, 100);
  await readingRepository.updateProgress(chapterId, "pdf", 20, 100);
  const readBack = await readingRepository.updateProgress(chapterId, "pdf", 5, 100);
  results.push({
    name: "reading monotonic maxPageReached",
    passed: readBack?.lastPage === 5 && readBack?.maxPageReached === 20,
    detail: `lastPage=${readBack?.lastPage} maxPageReached=${readBack?.maxPageReached}`,
  });

  await playbackRepository.updatePosition(chapterId, "mp3", 600, 1200);
  const playBack = await playbackRepository.updatePosition(chapterId, "mp3", 300, 1200);
  results.push({
    name: "audio monotonic maxPosition",
    passed: playBack?.currentTime === 300 && playBack?.maxPosition === 600,
    detail: `currentTime=${playBack?.currentTime} maxPosition=${playBack?.maxPosition}`,
  });

  return results;
}
