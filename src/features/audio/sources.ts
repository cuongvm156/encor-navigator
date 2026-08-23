/**
 * Resolves a playable audio URL for a chapter.
 *
 * No copyrighted Cisco/CCNP media is committed to this repository.
 *
 * Availability is chapter-specific: a chapter has audio ONLY when its own
 * `audioResourceId` + `audioUrl` (or a real `audio` resource row) are set.
 * There is no global fallback — chapters without audio must never inherit
 * another chapter's media (Sprint 3C.1).
 */

import { getAudioResource, hasAudioResource } from "@/data/resourceManifest";
import type { Chapter, Resource } from "@/features/course/types";
import type { AudioSource } from "./types";

export type AudioSourceKind = "chapter" | "unavailable";

const isUrl = (value: string | undefined): value is string =>
  typeof value === "string" && /^(https?:)?\/\//.test(value.trim());

export function resolveAudioSource(chapter: Chapter, resources: Resource[]): AudioSource {
  const track = resources.find((r) => r.chapterId === chapter.id && r.kind === "audio");
  const resourceUrl = isUrl(track?.source) ? track.source : undefined;
  const manifest = getAudioResource(chapter.id);
  const chapterUrl = isUrl(manifest?.url) ? manifest.url : undefined;
  const src = resourceUrl ?? chapterUrl;
  const resourceId = track?.id ?? manifest?.resourceId;

  return {
    chapterId: chapter.id,
    resourceId: resourceId ?? `${chapter.id}:no-audio`,
    title: track?.title ?? "Chapter audio narration",
    ...(src && resourceId ? { src } : {}),
  };
}

/** True when the chapter has its own playable audio resource. */
export const hasAudio = (chapter: Chapter, resources: Resource[] = []) =>
  hasAudioResource(chapter.id) || Boolean(resolveAudioSource(chapter, resources).src);

/** Ordered list of chapters that resolve to a playable audio source. */
export function playableAudioChapters(chapters: Chapter[], resources: Resource[]): Chapter[] {
  return chapters.filter((chapter) => hasAudio(chapter, resources));
}
