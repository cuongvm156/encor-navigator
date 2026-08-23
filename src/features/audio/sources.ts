/**
 * Resolves a playable audio URL for a chapter.
 *
 * No copyrighted Cisco/CCNP media is committed to this repository.
 *
 * Resolution order:
 *   1. real valid audio URL from chapter/resource data
 *   2. the single canonical demo URL (see src/config/demoAudio.ts)
 *   3. otherwise → no src, the UI shows "audio unavailable"
 *
 * There is intentionally no environment-variable override: desktop and mobile
 * previews must always resolve the exact same demo file.
 */

import { DEMO_AUDIO_URL } from "@/config/demoAudio";
import type { Chapter, Resource } from "@/features/course/types";
import type { AudioSource } from "./types";

/** Stable id used when a chapter has no real audio resource yet. */
export const DEMO_RESOURCE_ID = "demo-audio";

export type AudioSourceKind = "chapter" | "demo" | "unavailable";

const isUrl = (value: string | undefined): value is string =>
  typeof value === "string" && /^(https?:)?\/\//.test(value.trim());

export function resolveAudioSource(chapter: Chapter, resources: Resource[]): AudioSource {
  const track = resources.find((r) => r.chapterId === chapter.id && r.kind === "audio");
  const chapterUrl = isUrl(track?.source) ? track.source : undefined;
  const src = chapterUrl ?? (isUrl(DEMO_AUDIO_URL) ? DEMO_AUDIO_URL : undefined);
  const kind: AudioSourceKind = chapterUrl ? "chapter" : src ? "demo" : "unavailable";

  // TEMPORARY dev logging (Sprint 2B.1 smoke test) — remove in Sprint 2C+.
  if (import.meta.env.DEV && typeof window !== "undefined") {
    console.info("[audio] source resolved", {
      chapter: `${chapter.number}. ${chapter.title}`,
      chapterId: chapter.id,
      src: src ?? null,
      kind,
    });
  }

  return {
    chapterId: chapter.id,
    resourceId: track?.id ?? DEMO_RESOURCE_ID,
    title: track?.title ?? "Chapter audio narration",
    ...(src ? { src } : {}),
  };
}

/** Ordered list of chapters that resolve to a playable audio source. */
export function playableAudioChapters(chapters: Chapter[], resources: Resource[]): Chapter[] {
  return chapters.filter((chapter) => Boolean(resolveAudioSource(chapter, resources).src));
}
