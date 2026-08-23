/**
 * Sprint 4B — reactive access to offline resource metadata plus source
 * resolution for Reader and Audio.
 *
 * Resolution order (per chapter and kind):
 *   1. ready local-import resource
 *   2. ready downloaded manifest resource
 *   3. online manifest URL
 *   4. unavailable
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { getDb } from "@/db/database";
import type { OfflineResourceKind, OfflineResourceRecord } from "@/db/schema";
import { getAudioResource, getPdfResource } from "@/data/resourceManifest";
import { offlineResourcesRepository } from "@/repositories/offlineResourcesRepository";
import { getOfflineBlob, offlineUrlFor, storageEstimate } from "./cache";
import { subscribeToDownloads, type DownloadProgress } from "./downloads";
import { offlineRouteAvailable } from "./serviceWorker";

const EMPTY: OfflineResourceRecord[] = [];

/** All offline metadata rows, live. */
export function useOfflineResources(): OfflineResourceRecord[] {
  const rows = useLiveQuery(async () => {
    const db = getDb();
    if (!db) return EMPTY;
    return db.offlineResources.toArray();
  }, []);
  return rows ?? EMPTY;
}

/** Reconciles Dexie metadata with Cache Storage once per app session. */
let reconciled = false;
export function useOfflineReconciliation() {
  useEffect(() => {
    if (reconciled || typeof window === "undefined") return;
    reconciled = true;
    void offlineResourcesRepository.reconcileWithCache().catch((error) => {
      console.warn("[offline] reconciliation failed", error);
    });
  }, []);
}

/** Live map of in-flight downloads. */
export function useActiveDownloads(): Record<string, DownloadProgress> {
  return useSyncExternalStore(
    (onChange) => subscribeToDownloads(() => onChange()),
    () => downloadSnapshot(),
    () => EMPTY_DOWNLOADS,
  );
}

const EMPTY_DOWNLOADS: Record<string, DownloadProgress> = {};
let snapshot: Record<string, DownloadProgress> = EMPTY_DOWNLOADS;
if (typeof window !== "undefined") {
  subscribeToDownloads((active) => {
    snapshot = active;
  });
}
const downloadSnapshot = () => snapshot;

export interface ResolvedResource {
  /** URL to feed PDF.js / HTMLAudioElement, when available. */
  url?: string;
  /** Identity used for progress, notes and bookmarks. */
  resourceId?: string;
  origin: "local-import" | "download" | "online" | "unavailable";
  fileName?: string;
}

export function pickOffline(
  rows: OfflineResourceRecord[],
  chapterId: string,
  kind: OfflineResourceKind,
  sourceType: "local-import" | "download",
): OfflineResourceRecord | undefined {
  return rows
    .filter(
      (row) =>
        row.chapterId === chapterId &&
        row.kind === kind &&
        row.sourceType === sourceType &&
        row.status === "ready",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function resolveResource(
  rows: OfflineResourceRecord[],
  chapterId: string,
  kind: OfflineResourceKind,
): ResolvedResource {
  const manifest = kind === "pdf" ? getPdfResource(chapterId) : getAudioResource(chapterId);

  const local = pickOffline(rows, chapterId, kind, "local-import");
  if (local) {
    return {
      url: offlineUrlFor(local.resourceId),
      resourceId: local.resourceId,
      origin: "local-import",
      ...(local.originalFileName ? { fileName: local.originalFileName } : {}),
    };
  }

  if (manifest) {
    const downloaded = rows.find(
      (row) => row.resourceId === manifest.resourceId && row.status === "ready",
    );
    if (downloaded) {
      return {
        url: offlineUrlFor(downloaded.resourceId),
        resourceId: downloaded.resourceId,
        origin: "download",
        ...(downloaded.originalFileName ? { fileName: downloaded.originalFileName } : {}),
      };
    }
    return {
      ...(manifest.url ? { url: manifest.url } : {}),
      resourceId: manifest.resourceId,
      origin: manifest.url ? "online" : "unavailable",
      ...(manifest.fileName ? { fileName: manifest.fileName } : {}),
    };
  }

  return { origin: "unavailable" };
}

/**
 * Resolves a chapter resource, preferring offline copies.
 *
 * When no service worker controls the page (dev preview, first load before
 * activation), the synthetic URL cannot be intercepted, so a TEMPORARY object
 * URL is created from Cache Storage and revoked on cleanup. Object URLs are
 * never persisted as identifiers.
 */
export function useResolvedResource(
  chapterId: string | undefined,
  kind: OfflineResourceKind,
): ResolvedResource {
  const rows = useOfflineResources();
  const resolved = useMemo(
    () => (chapterId ? resolveResource(rows, chapterId, kind) : { origin: "unavailable" as const }),
    [rows, chapterId, kind],
  );
  const [fallbackUrl, setFallbackUrl] = useState<string | undefined>(undefined);

  const isSynthetic = resolved.origin === "local-import" || resolved.origin === "download";
  const resourceId = resolved.resourceId;

  useEffect(() => {
    setFallbackUrl(undefined);
    if (!isSynthetic || !resourceId || offlineRouteAvailable()) return;
    let objectUrl: string | undefined;
    let cancelled = false;
    void getOfflineBlob(resourceId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setFallbackUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isSynthetic, resourceId]);

  if (isSynthetic && !offlineRouteAvailable()) {
    return fallbackUrl ? { ...resolved, url: fallbackUrl } : { ...resolved, url: undefined };
  }
  return resolved;
}

/** Browser storage usage/quota, or undefined when unsupported. */
export function useStorageEstimate() {
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | undefined>(
    undefined,
  );
  const [supported, setSupported] = useState(true);
  const rows = useOfflineResources();

  useEffect(() => {
    void storageEstimate().then((value) => {
      setSupported(Boolean(value));
      setEstimate(value);
    });
  }, [rows.length]);

  return { estimate, supported };
}
