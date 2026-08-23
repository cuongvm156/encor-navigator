/**
 * Resolves a playable audio URL for a chapter.
 *
 * No copyrighted Cisco/CCNP media is committed to this repository. A chapter
 * only becomes playable when its audio resource carries a real URL, or when a
 * developer supplies `VITE_DEMO_AUDIO_URL` for local testing.
 */

import type { Chapter, Resource } from "@/features/course/types";
import type { AudioSource } from "./types";

const isUrl = (value: string | undefined): value is string =>
  typeof value === "string" && /^(https?:)?\/\//.test(value.trim());

const demoUrl = (): string | undefined => {
  const value = import.meta.env["VITE_DEMO_AUDIO_URL"] as string | undefined;
  return isUrl(value) ? value : undefined;
};

export function resolveAudioSource(chapter: Chapter, resources: Resource[]): AudioSource {
  const track = resources.find((r) => r.chapterId === chapter.id && r.kind === "audio");
  const src = isUrl(track?.source) ? track?.source : demoUrl();
  return {
    chapterId: chapter.id,
    title: track?.title ?? "Chapter audio narration",
    ...(src ? { src } : {}),
  };
}
