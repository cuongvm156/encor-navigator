/**
 * Sprint 6A.1 — MediaTrack resolution (track-scoped).
 *
 * A MediaTrack is ONE logical learning item with up to two renditions (audio /
 * video). Resolution is scoped to the exact track, so two tracks inside one
 * chapter never share an imported file:
 *
 *   1. ready local import explicitly bound to this trackId
 *   2. ready local import bound to this rendition's manifest resourceId
 *   3. LEGACY ready local import with no track association — accepted ONLY when
 *      the chapter declares exactly one MediaTrack (pre-v5 rows stay usable and
 *      are never misassigned when the chapter is ambiguous)
 *   4. ready download of the manifest resource
 *   5. online manifest URL
 *   6. unavailable
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
export type RenditionOrigin =
  | "local-import"
  | "local-import-legacy"
  | "download"
  | "online"
  | "unavailable";

export interface ResolvedRendition {
  mode: MediaMode;
  origin: RenditionOrigin;
  /** Playback identity used for legacy playbackStates + offline metadata. */
  resourceId?: string;
  url?: string;
  fileName?: string;
  offline: boolean;
  /** The offline metadata row backing this rendition, when there is one. */
  record?: OfflineResourceRecord;
}

export interface ResolvedTrack {
  track: MediaTrack;
  audio: ResolvedRendition;
  video: ResolvedRendition;
}

export interface ResolveOptions {
  /**
   * Number of MediaTracks declared by the chapter. Injected by tests; defaults
   * to the manifest. Legacy (unassociated) offline rows are only used when this
   * is exactly 1.
   */
  chapterTrackCount?: number;
}

const newest = (rows: OfflineResourceRecord[]) =>
  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

const fromRow = (
  mode: MediaMode,
  row: OfflineResourceRecord,
  origin: RenditionOrigin,
): ResolvedRendition => ({
  mode,
  origin,
  resourceId: row.resourceId,
  url: offlineUrlFor(row.resourceId),
  offline: true,
  record: row,
  ...(row.originalFileName ? { fileName: row.originalFileName } : {}),
});

export function resolveRendition(
  rows: OfflineResourceRecord[],
  track: MediaTrack,
  mode: MediaMode,
  options: ResolveOptions = {},
): ResolvedRendition {
  const manifestId = mode === "audio" ? track.audioResourceId : track.videoResourceId;
  const manifest = getResourceById(manifestId);
  const trackCount = options.chapterTrackCount ?? getMediaTracks(track.chapterId).length;

  const ready = rows.filter(
    (row) => row.chapterId === track.chapterId && row.kind === mode && row.status === "ready",
  );
  const localRows = ready.filter((row) => row.sourceType === "local-import");

  // 1 — explicit track binding.
  const boundToTrack = newest(localRows.filter((row) => row.trackId === track.trackId));
  if (boundToTrack) return fromRow(mode, boundToTrack, "local-import");

  // 2 — bound to this rendition's manifest identity.
  const boundToResource = manifestId
    ? newest(localRows.filter((row) => row.targetResourceId === manifestId))
    : undefined;
  if (boundToResource) return fromRow(mode, boundToResource, "local-import");

  // 3 — legacy, chapter-wide rows: only safe when the chapter has one track.
  if (trackCount <= 1) {
    const legacy = newest(localRows.filter((row) => !row.trackId && !row.targetResourceId));
    if (legacy) return fromRow(mode, legacy, "local-import-legacy");
  }

  // 4 — a download of the exact manifest rendition.
  const downloaded = manifestId
    ? ready.find((row) => row.resourceId === manifestId)
    : undefined;
  if (downloaded) return fromRow(mode, downloaded, "download");

  // 5 — online manifest URL.
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

export function resolveTrack(
  rows: OfflineResourceRecord[],
  track: MediaTrack,
  options: ResolveOptions = {},
): ResolvedTrack {
  return {
    track,
    audio: resolveRendition(rows, track, "audio", options),
    video: resolveRendition(rows, track, "video", options),
  };
}

export function resolveChapterTracks(
  rows: OfflineResourceRecord[],
  chapterId: string,
  tracks: MediaTrack[] = getMediaTracks(chapterId),
): ResolvedTrack[] {
  return tracks.map((track) => resolveTrack(rows, track, { chapterTrackCount: tracks.length }));
}

export function resolveTrackById(
  rows: OfflineResourceRecord[],
  chapterId: string,
  trackId: string,
  tracks: MediaTrack[] = getMediaTracks(chapterId),
): ResolvedTrack | undefined {
  const track = tracks.find((entry) => entry.trackId === trackId) ?? getMediaTrack(chapterId, trackId);
  return track ? resolveTrack(rows, track, { chapterTrackCount: tracks.length }) : undefined;
}

export const isPlayable = (rendition: ResolvedRendition) => Boolean(rendition.url);

/** True when either rendition of the track can be played right now. */
export const trackPlayable = (resolved: ResolvedTrack) =>
  isPlayable(resolved.audio) || isPlayable(resolved.video);

export interface PlaylistEntry {
  chapterId: string;
  trackId: string;
}

export interface PlaylistOptions {
  /** Restrict the playlist to tracks whose given rendition is playable. */
  mode?: MediaMode;
  /** Track lookup override (tests inject fixtures instead of the manifest). */
  tracksOf?: (chapterId: string) => MediaTrack[];
}

/**
 * Playlist order: tracks within a chapter first, then the next chapter that has
 * a playable track. With exactly one track per chapter this is identical to the
 * pre-existing chapter-to-chapter behaviour.
 */
export function buildPlaylist(
  rows: OfflineResourceRecord[],
  chapterIds: string[],
  options: PlaylistOptions = {},
): PlaylistEntry[] {
  const tracksOf = options.tracksOf ?? getMediaTracks;
  const entries: PlaylistEntry[] = [];
  for (const chapterId of chapterIds) {
    for (const resolved of resolveChapterTracks(rows, chapterId, tracksOf(chapterId))) {
      const playable = options.mode
        ? isPlayable(options.mode === "audio" ? resolved.audio : resolved.video)
        : trackPlayable(resolved);
      if (playable) entries.push({ chapterId, trackId: resolved.track.trackId });
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

/** Next track INSIDE the chapter, wrapping to the first (Repeat Lesson). */
export function nextInChapter(
  playlist: PlaylistEntry[],
  chapterId: string,
  trackId: string,
): PlaylistEntry | undefined {
  const inChapter = playlist.filter((entry) => entry.chapterId === chapterId);
  if (inChapter.length === 0) return undefined;
  const index = inChapter.findIndex((entry) => entry.trackId === trackId);
  if (index < 0) return inChapter[0];
  return inChapter[(index + 1) % inChapter.length];
}
