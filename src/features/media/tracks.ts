/**
 * Sprint 6A.1 — MediaTrack resolution.
 *
 * A MediaTrack is ONE logical learning item with up to two renditions (audio /
 * video). Resolution order per rendition mirrors Sprint 4B:
 *   1. ready local import for the chapter + kind
 *   2. ready download of the manifest resource
 *   3. online manifest URL
 *   4. unavailable
 *
 * There is never a fallback between tracks or between chapters.
 */

import {
  getMediaTrack,
  getMediaTracks,
  getResourceById,
  type MediaTrack,
} from "@/data/resourceManifest";
import type { OfflineResourceRecord } from "@/db/schema";
import { offlineUrlFor } from "@/features/offline/cache";

export type MediaMode = "audio" | "video";
export type RenditionOrigin = "local-import" | "download" | "online" | "unavailable";

export interface ResolvedRendition {
  mode: MediaMode;
  origin: RenditionOrigin;
  /** Playback identity used for legacy playbackStates + offline metadata. */
  resourceId?: string;
  url?: string;
  fileName?: string;
  offline: boolean;
}

export interface ResolvedTrack {
  track: MediaTrack;
  audio: ResolvedRendition;
  video: ResolvedRendition;
}

const readyRows = (rows: OfflineResourceRecord[], chapterId: string, mode: MediaMode) =>
  rows.filter((row) => row.chapterId === chapterId && row.kind === mode && row.status === "ready");

export function resolveRendition(
  rows: OfflineResourceRecord[],
  track: MediaTrack,
  mode: MediaMode,
): ResolvedRendition {
  const manifestId = mode === "audio" ? track.audioResourceId : track.videoResourceId;
  const manifest = getResourceById(manifestId);
  const chapterRows = readyRows(rows, track.chapterId, mode);

  const local = chapterRows
    .filter((row) => row.sourceType === "local-import")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (local) {
    return {
      mode,
      origin: "local-import",
      resourceId: local.resourceId,
      url: offlineUrlFor(local.resourceId),
      offline: true,
      ...(local.originalFileName ? { fileName: local.originalFileName } : {}),
    };
  }

  const downloaded = manifestId
    ? chapterRows.find((row) => row.resourceId === manifestId)
    : undefined;
  if (downloaded) {
    return {
      mode,
      origin: "download",
      resourceId: downloaded.resourceId,
      url: offlineUrlFor(downloaded.resourceId),
      offline: true,
      ...(downloaded.originalFileName ? { fileName: downloaded.originalFileName } : {}),
    };
  }

  const active =
    manifest && (manifest.status === "available" || manifest.status === "testing") && manifest.url;
  if (active && manifest) {
    return {
      mode,
      origin: "online",
      resourceId: manifest.resourceId,
      url: manifest.url as string,
      offline: false,
      ...(manifest.fileName ? { fileName: manifest.fileName } : {}),
    };
  }

  return {
    mode,
    origin: "unavailable",
    offline: false,
    ...(manifestId ? { resourceId: manifestId } : {}),
  };
}

export function resolveTrack(rows: OfflineResourceRecord[], track: MediaTrack): ResolvedTrack {
  return {
    track,
    audio: resolveRendition(rows, track, "audio"),
    video: resolveRendition(rows, track, "video"),
  };
}

export function resolveChapterTracks(
  rows: OfflineResourceRecord[],
  chapterId: string,
): ResolvedTrack[] {
  return getMediaTracks(chapterId).map((track) => resolveTrack(rows, track));
}

export function resolveTrackById(
  rows: OfflineResourceRecord[],
  chapterId: string,
  trackId: string,
): ResolvedTrack | undefined {
  const track = getMediaTrack(chapterId, trackId);
  return track ? resolveTrack(rows, track) : undefined;
}

export const isPlayable = (rendition: ResolvedRendition) => Boolean(rendition.url);

/** True when either rendition of the track can be played right now. */
export const trackPlayable = (resolved: ResolvedTrack) =>
  isPlayable(resolved.audio) || isPlayable(resolved.video);

export interface PlaylistEntry {
  chapterId: string;
  trackId: string;
}

/**
 * Playlist order: tracks within a chapter first, then the next chapter that has
 * a playable track. With exactly one track per chapter this is identical to the
 * pre-existing chapter-to-chapter behaviour.
 */
export function buildPlaylist(
  rows: OfflineResourceRecord[],
  chapterIds: string[],
): PlaylistEntry[] {
  const entries: PlaylistEntry[] = [];
  for (const chapterId of chapterIds) {
    for (const resolved of resolveChapterTracks(rows, chapterId)) {
      if (trackPlayable(resolved)) {
        entries.push({ chapterId, trackId: resolved.track.trackId });
      }
    }
  }
  return entries;
}

export function neighbours(
  playlist: PlaylistEntry[],
  chapterId: string,
  trackId: string | undefined,
): { previous?: PlaylistEntry; next?: PlaylistEntry; index: number } {
  const index = playlist.findIndex(
    (entry) => entry.chapterId === chapterId && (!trackId || entry.trackId === trackId),
  );
  if (index < 0) return { index: -1 };
  return {
    index,
    ...(index > 0 ? { previous: playlist[index - 1] as PlaylistEntry } : {}),
    ...(index < playlist.length - 1 ? { next: playlist[index + 1] as PlaylistEntry } : {}),
  };
}
