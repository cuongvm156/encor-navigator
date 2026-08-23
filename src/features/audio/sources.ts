/**
 * Resolves a playable audio URL for a chapter.
 *
 * No copyrighted Cisco/CCNP media is committed to this repository.
 *
 * Resolution order:
 *   1. real valid audio URL from chapter/resource data
 *   2. `VITE_DEMO_AUDIO_URL` (local developer override, when defined)
 *   3. `DEMO_AUDIO_URL` development smoke-test fallback (see src/config/demoAudio.ts)
 *   4. otherwise → no src, the UI shows "audio unavailable"
 */

import { DEMO_AUDIO_URL } from "@/config/demoAudio";
import type { Chapter, Resource } from "@/features/course/types";
import type { AudioSource } from "./types";

const isUrl = (value: string | undefined): value is string =>
  typeof value === "string" && /^(https?:)?\/\//.test(value.trim());

const envDemoUrl = (): string | undefined => {
  const value = import.meta.env["VITE_DEMO_AUDIO_URL"] as string | undefined;
  return isUrl(value) ? value : undefined;
};

/** TODO: remove once real ENCOR audio resources exist in the course data. */
const smokeTestFallbackUrl = (): string | undefined =>
  isUrl(DEMO_AUDIO_URL) ? DEMO_AUDIO_URL : undefined;

export function resolveAudioSource(chapter: Chapter, resources: Resource[]): AudioSource {
  const track = resources.find((r) => r.chapterId === chapter.id && r.kind === "audio");
  const src = isUrl(track?.source)
    ? track.source
    : (envDemoUrl() ?? smokeTestFallbackUrl());
  return {
    chapterId: chapter.id,
    title: track?.title ?? "Chapter audio narration",
    ...(src ? { src } : {}),
  };
}
