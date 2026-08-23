/**
 * Sprint 6A.1 fix — React access to TRACK-SCOPED media resolution.
 *
 * Everything here resolves the exact MediaTrack rendition (`track.audioResourceId`
 * / `track.videoResourceId`); nothing resolves media chapter-wide. PDF document
 * identity is untouched and still goes through `useResolvedResource`.
 */

import { useEffect, useMemo, useState } from "react";

import { MANIFEST_CHAPTER_IDS, getMediaTracks } from "@/data/resourceManifest";
import { getOfflineBlob, hasOfflineBinary } from "@/features/offline/cache";
import { offlineRouteAvailable } from "@/features/offline/serviceWorker";
import {
  useOfflineReconciliation,
  useOfflineResources,
} from "@/features/offline/useOfflineResources";
import {
  buildPlaylist,
  resolveChapterTracks,
  type MediaMode,
  type PlaylistEntry,
  type ResolvedRendition,
  type ResolvedTrack,
} from "./tracks";

export interface ChapterTracks {
  tracks: ResolvedTrack[];
  loading: boolean;
}

/** All resolved MediaTracks of one chapter. */
export function useChapterTracks(chapterId: string | undefined): ChapterTracks {
  const reconciled = useOfflineReconciliation();
  const rows = useOfflineResources();
  const tracks = useMemo(
    () => (chapterId ? resolveChapterTracks(rows, chapterId) : []),
    [rows, chapterId],
  );
  return { tracks, loading: typeof window !== "undefined" && !reconciled };
}

export interface ResolvedTrackResult extends ChapterTracks {
  resolved: ResolvedTrack | undefined;
  /** 1-based position of the resolved track inside its chapter. */
  position: number;
}

/**
 * Resolves the EXACT requested track. When no `trackId` is given the first
 * declared track of the chapter is used (legacy one-track deep links).
 */
export function useResolvedTrack(
  chapterId: string | undefined,
  trackId: string | undefined,
): ResolvedTrackResult {
  const { tracks, loading } = useChapterTracks(chapterId);
  const resolved = trackId
    ? tracks.find((entry) => entry.track.trackId === trackId)
    : tracks[0];
  const position = resolved
    ? tracks.findIndex((entry) => entry.track.trackId === resolved.track.trackId) + 1
    : 0;
  return { tracks, loading, resolved, position };
}

export interface RenditionSource {
  url?: string;
  resourceId?: string;
  fileName?: string;
  offline: boolean;
  loading: boolean;
  /** True when nothing playable exists for this rendition right now. */
  unavailable: boolean;
}

const EMPTY_SOURCE: RenditionSource = {
  offline: false,
  loading: false,
  unavailable: true,
};

/**
 * Turns a resolved rendition into a URL that can actually be handed to the
 * media element. Offline copies normally use the same-origin synthetic URL; if
 * no service worker controls the page a TEMPORARY object URL is created from
 * Cache Storage and revoked on cleanup (never persisted as an identifier).
 */
export function useRenditionSource(
  rendition: ResolvedRendition | undefined,
  metadataLoading = false,
): RenditionSource {
  const isSynthetic =
    rendition?.origin === "local-import" ||
    rendition?.origin === "local-import-legacy" ||
    rendition?.origin === "download";
  const resourceId = rendition?.resourceId;
  const needsObjectUrl = isSynthetic && !offlineRouteAvailable();

  const [binary, setBinary] = useState<"unknown" | "present" | "missing">("unknown");
  const [fallbackUrl, setFallbackUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    setBinary("unknown");
    if (!isSynthetic || !resourceId) return;
    let cancelled = false;
    void hasOfflineBinary(resourceId).then((exists) => {
      if (!cancelled) setBinary(exists ? "present" : "missing");
    });
    return () => {
      cancelled = true;
    };
  }, [isSynthetic, resourceId]);

  useEffect(() => {
    setFallbackUrl(undefined);
    if (!needsObjectUrl || !resourceId) return;
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
  }, [needsObjectUrl, resourceId]);

  if (!rendition) return EMPTY_SOURCE;
  if (metadataLoading) {
    return { offline: false, loading: true, unavailable: false };
  }

  const base: RenditionSource = {
    offline: rendition.offline,
    loading: false,
    unavailable: false,
    ...(rendition.resourceId ? { resourceId: rendition.resourceId } : {}),
    ...(rendition.fileName ? { fileName: rendition.fileName } : {}),
  };

  if (isSynthetic) {
    if (binary === "unknown") return { ...base, loading: true };
    if (binary === "missing") return { ...base, unavailable: true };
    if (needsObjectUrl) {
      return fallbackUrl ? { ...base, url: fallbackUrl } : { ...base, loading: true };
    }
    return { ...base, url: rendition.url as string };
  }

  if (rendition.origin === "online" && rendition.url) return { ...base, url: rendition.url };
  return { ...base, unavailable: true };
}

/** Ordered playlist of every playable MediaTrack in course order. */
export function useMediaPlaylist(mode?: MediaMode): PlaylistEntry[] {
  const rows = useOfflineResources();
  return useMemo(
    () => buildPlaylist(rows, MANIFEST_CHAPTER_IDS, mode ? { mode } : {}),
    [rows, mode],
  );
}

/** Declared track count of a chapter (manifest only, no offline state). */
export const declaredTrackCount = (chapterId: string) => getMediaTracks(chapterId).length;
