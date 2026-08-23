/**
 * Offline resource METADATA repository (Sprint 4B).
 *
 * The binary lives in Cache Storage; this table is searchable metadata only.
 * Nothing in here reads or writes progress, playback, notes or bookmarks.
 */

import { getDb } from "@/db/database";
import type {
  OfflineResourceKind,
  OfflineResourceRecord,
  OfflineResourceStatus,
  OfflineSourceType,
} from "@/db/schema";
import { deleteOfflineBinary, listCachedResourceIds, offlineUrlFor } from "@/features/offline/cache";

const now = () => new Date().toISOString();

export interface UpsertOfflineInput {
  resourceId: string;
  chapterId: string;
  /** MediaTrack this offline copy belongs to (audio/video only). */
  trackId?: string;
  /** Manifest rendition id this offline copy stands in for (audio/video only). */
  targetResourceId?: string;
  kind: OfflineResourceKind;
  sourceType: OfflineSourceType;
  status: OfflineResourceStatus;
  sourceUrl?: string;
  originalFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  errorMessage?: string;
}

export const offlineResourcesRepository = {
  async getAll(): Promise<OfflineResourceRecord[]> {
    const db = getDb();
    if (!db) return [];
    return db.offlineResources.toArray();
  },

  async get(resourceId: string): Promise<OfflineResourceRecord | undefined> {
    const db = getDb();
    if (!db) return undefined;
    return db.offlineResources.get(resourceId);
  },

  async byChapter(chapterId: string): Promise<OfflineResourceRecord[]> {
    const db = getDb();
    if (!db) return [];
    return db.offlineResources.where("chapterId").equals(chapterId).toArray();
  },

  async upsert(input: UpsertOfflineInput): Promise<OfflineResourceRecord | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const existing = await db.offlineResources.get(input.resourceId);
    const record: OfflineResourceRecord = {
      ...existing,
      id: input.resourceId,
      resourceId: input.resourceId,
      chapterId: input.chapterId,
      kind: input.kind,
      sourceType: input.sourceType,
      status: input.status,
      ...(input.trackId ? { trackId: input.trackId } : {}),
      ...(input.targetResourceId ? { targetResourceId: input.targetResourceId } : {}),
      offlineUrl: offlineUrlFor(input.resourceId),
      updatedAt: now(),
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
      ...(input.originalFileName ? { originalFileName: input.originalFileName } : {}),
      ...(input.mimeType ? { mimeType: input.mimeType } : {}),
      ...(typeof input.sizeBytes === "number" ? { sizeBytes: input.sizeBytes } : {}),
      ...(input.status === "ready" ? { downloadedAt: now() } : {}),
    };
    if (input.errorMessage) record.errorMessage = input.errorMessage;
    else delete record.errorMessage;
    await db.offlineResources.put(record);
    return record;
  },

  async markError(resourceId: string, message: string): Promise<void> {
    const db = getDb();
    if (!db) return;
    const existing = await db.offlineResources.get(resourceId);
    if (!existing) return;
    await db.offlineResources.put({
      ...existing,
      status: "error",
      errorMessage: message,
      updatedAt: now(),
    });
  },

  /**
   * Removes ONE offline resource: its cached binary and its metadata row.
   * Reading progress, playback state, notes and bookmarks are untouched.
   */
  async remove(resourceId: string): Promise<void> {
    await deleteOfflineBinary(resourceId);
    const db = getDb();
    if (!db) return;
    await db.offlineResources.delete(resourceId);
  },

  /**
   * Startup reconciliation: metadata claiming `ready` without a cache entry is
   * downgraded to `error`. Never deletes user data, never deletes binaries.
   */
  async reconcileWithCache(): Promise<number> {
    const db = getDb();
    if (!db) return 0;
    const [rows, cachedIds] = await Promise.all([
      db.offlineResources.toArray(),
      listCachedResourceIds(),
    ]);
    const cached = new Set(cachedIds);
    let repaired = 0;
    for (const row of rows) {
      const present = cached.has(row.resourceId);
      if (row.status === "ready" && !present) {
        await db.offlineResources.put({
          ...row,
          status: "error",
          errorMessage: "Offline file is no longer stored on this device.",
          updatedAt: now(),
        });
        repaired += 1;
      } else if (row.status === "downloading") {
        // A download interrupted by a refresh is never kept as ready.
        await db.offlineResources.put({
          ...row,
          status: present ? "ready" : "error",
          ...(present ? {} : { errorMessage: "Download was interrupted." }),
          updatedAt: now(),
        });
        repaired += 1;
      }
    }
    return repaired;
  },
};

export type OfflineResourcesRepository = typeof offlineResourcesRepository;
