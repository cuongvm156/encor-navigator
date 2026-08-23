/**
 * Database entry point — placeholder.
 *
 * Sprint 2 will instantiate Dexie here using DB_NAME / DB_VERSION / STORES from
 * `./schema`, with explicit versioned migrations.
 *
 * Rules:
 * - never call `delete()` / clear stores on upgrade — user data survives upgrades
 * - only repositories in `src/repositories/*` may import this module
 * - UI components must never import it
 */

import { DB_NAME, DB_VERSION, STORES } from "./schema";

// TODO(Sprint 2): export a Dexie instance (`export const db = new Dexie(DB_NAME)`).
export const dbConfig = { name: DB_NAME, version: DB_VERSION, stores: STORES } as const;
