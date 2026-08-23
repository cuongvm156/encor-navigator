/**
 * Sprint 4A — Centralized PDF / audio resource manifest.
 *
 * THE single place where chapter documents and audio files are declared.
 * Reader, Audio, Chapter Detail, Dashboard and Settings read availability from
 * the selectors below, so adding or replacing an official file never requires
 * touching feature code.
 *
 * This module is intentionally dependency-light (relative imports only, no path
 * aliases): the build-time validator loads it directly from Node and from the
 * Vite config.
 */

/**
 * Temporary smoke-test audio (Chapter 1 only). Declared here so this module has
 * zero imports and can be loaded directly by the build-time validator.
 * Re-exported by `src/config/demoAudio.ts` for existing callers.
 */
export const DEMO_AUDIO_URL =
  "https://res.cloudinary.com/wvlih3ec/video/upload/v1787110709/0E_001_Audio.mp3";
export const DEMO_RESOURCE_ID = "demo-audio";

export type ResourceStatus = "unavailable" | "testing" | "available" | "archived";

interface BaseResource {
  resourceId: string;
  chapterId: string;
  status: ResourceStatus;
  /** Required for `available` / `testing`; absent otherwise (no fallbacks). */
  url?: string;
  fileName?: string;
  version?: number;
  label?: string;
}

export interface PdfResource extends BaseResource {
  kind: "pdf";
}

export interface AudioResource extends BaseResource {
  kind: "audio";
}

/**
 * Sprint 6A.1 — video rendition of a MediaTrack. Same identity/version/status
 * rules as PDF and audio: no fallback URL, no inheritance between chapters.
 */
export interface VideoResource extends BaseResource {
  kind: "video";
}

export type ChapterResource = PdfResource | AudioResource | VideoResource;

/**
 * A logical learning item inside a chapter. An MP3 exported from an MP4 is the
 * SAME MediaTrack rendered twice — never two independent lessons — so both
 * renditions share one resume/progress state (`mediaTrackStates`).
 */
export interface MediaTrack {
  trackId: string;
  chapterId: string;
  /** 1-based position inside the chapter; unique per chapter. */
  order: number;
  title: string;
  audioResourceId?: string;
  videoResourceId?: string;
  status?: ResourceStatus;
}

/** Chapters in the approved course scope (ch-01 … ch-29). */
export const MANIFEST_CHAPTER_IDS: string[] = Array.from(
  { length: 29 },
  (_, index) => `ch-${String(index + 1).padStart(2, "0")}`,
);

const unavailablePdf = (chapterId: string): PdfResource => ({
  resourceId: `${chapterId}:pdf:unavailable`,
  chapterId,
  kind: "pdf",
  status: "unavailable",
});

const unavailableAudio = (chapterId: string): AudioResource => ({
  resourceId: `${chapterId}:audio:unavailable`,
  chapterId,
  kind: "audio",
  status: "unavailable",
});

/**
 * Chapter 1 currently carries temporary technical test files. They are NOT the
 * official ENCOR content. Their resourceIds are stable so existing reading
 * progress, notes and bookmarks in IndexedDB stay attached.
 *
 * When the official Chapter 1 PDF arrives, add a NEW entry with resourceId
 * `encor-v2-ch01-packet-forwarding-v1` and archive the test entry — never reuse
 * `test-clcor-ch01-v1`.
 */
export const pdfResources: PdfResource[] = MANIFEST_CHAPTER_IDS.map((chapterId) =>
  chapterId === "ch-01"
    ? {
        resourceId: "test-clcor-ch01-v1",
        chapterId: "ch-01",
        kind: "pdf",
        status: "testing",
        url: "/pdfs/encor-v2-ch01-packet-forwarding.pdf",
        fileName: "encor-v2-ch01-packet-forwarding.pdf",
        version: 1,
        label: "Temporary CLCOR test PDF",
      }
    : unavailablePdf(chapterId),
);

export const audioResources: AudioResource[] = MANIFEST_CHAPTER_IDS.map((chapterId) =>
  chapterId === "ch-01"
    ? {
        resourceId: DEMO_RESOURCE_ID,
        chapterId: "ch-01",
        kind: "audio",
        status: "testing",
        url: DEMO_AUDIO_URL,
        version: 1,
        label: "Temporary demo audio (smoke test)",
      }
    : unavailableAudio(chapterId),
);

/**
 * Video renditions. No MP4 is committed to this repository and none is
 * fabricated: the Chapter 1 legacy track declares its video rendition as
 * `unavailable` until the user imports a real MP4 on their own device.
 */
export const videoResources: VideoResource[] = [
  {
    resourceId: "ch01-track01-video-v1",
    chapterId: "ch-01",
    kind: "video",
    status: "unavailable",
    version: 1,
    label: "Video rendition of the Chapter 1 technical test track (import required)",
  },
];

/**
 * MediaTrack catalogue. Only the legacy Chapter 1 smoke-test track exists —
 * official ENCOR track titles are never invented. Chapters may declare any
 * number of tracks; UI and validation are fully data-driven.
 */
export const mediaTracks: MediaTrack[] = [
  {
    trackId: "ch01-track01",
    chapterId: "ch-01",
    order: 1,
    title: "Technical test track 1 (demo audio)",
    audioResourceId: DEMO_RESOURCE_ID,
    videoResourceId: "ch01-track01-video-v1",
    status: "testing",
  },
];

export const resourceManifest: ChapterResource[] = [
  ...pdfResources,
  ...audioResources,
  ...videoResources,
];

const isActive = (resource: ChapterResource | undefined): boolean =>
  Boolean(resource && (resource.status === "available" || resource.status === "testing") && resource.url);

/** Active (available/testing) PDF for a chapter, if any. */
export function getPdfResource(chapterId: string): PdfResource | undefined {
  const entry = pdfResources.find((r) => r.chapterId === chapterId && isActive(r));
  return entry;
}

/** Active (available/testing) audio for a chapter, if any. */
export function getAudioResource(chapterId: string): AudioResource | undefined {
  return audioResources.find((r) => r.chapterId === chapterId && isActive(r));
}

/** Active (available/testing) video of a chapter, if any. */
export function getVideoResource(chapterId: string): VideoResource | undefined {
  return videoResources.find((r) => r.chapterId === chapterId && isActive(r));
}

/** Declared (any status) video row of a chapter. */
export const getDeclaredVideoResource = (chapterId: string): VideoResource | undefined =>
  videoResources.find((r) => r.chapterId === chapterId);

/** Active (available/testing) video by resourceId, if any. */
export function getVideoResourceById(resourceId: string | undefined): VideoResource | undefined {
  if (!resourceId) return undefined;
  const entry = videoResources.find((r) => r.resourceId === resourceId);
  return entry && isActive(entry) ? entry : undefined;
}

export function getAudioResourceById(resourceId: string | undefined): AudioResource | undefined {
  if (!resourceId) return undefined;
  const entry = audioResources.find((r) => r.resourceId === resourceId);
  return entry && isActive(entry) ? entry : undefined;
}

/** Declared (any status) resource row by id. */
export const getResourceById = (resourceId: string | undefined): ChapterResource | undefined =>
  resourceId ? resourceManifest.find((r) => r.resourceId === resourceId) : undefined;

/** Ordered MediaTracks of a chapter. */
export function getMediaTracks(chapterId: string): MediaTrack[] {
  return mediaTracks
    .filter((track) => track.chapterId === chapterId)
    .sort((a, b) => a.order - b.order);
}

export function getMediaTrack(chapterId: string, trackId: string): MediaTrack | undefined {
  return getMediaTracks(chapterId).find((track) => track.trackId === trackId);
}

/** All tracks in chapter order across the whole course. */
export const allMediaTracks = (chapterIds: string[] = MANIFEST_CHAPTER_IDS): MediaTrack[] =>
  chapterIds.flatMap((chapterId) => getMediaTracks(chapterId));

export const hasPdfResource = (chapterId: string): boolean => Boolean(getPdfResource(chapterId));
export const hasAudioResource = (chapterId: string): boolean => Boolean(getAudioResource(chapterId));

/** Declared status for a chapter (falls back to "unavailable"). */
export const pdfStatus = (chapterId: string): ResourceStatus =>
  pdfResources.find((r) => r.chapterId === chapterId)?.status ?? "unavailable";
export const audioStatus = (chapterId: string): ResourceStatus =>
  audioResources.find((r) => r.chapterId === chapterId)?.status ?? "unavailable";

export const getAvailablePdfCount = (): number => pdfResources.filter(isActive).length;
export const getAvailableAudioCount = (): number => audioResources.filter(isActive).length;
export const getAvailableVideoCount = (): number => videoResources.filter(isActive).length;
export const getMediaTrackCount = (): number => mediaTracks.length;
export const getTestingResourceCount = (): number =>
  resourceManifest.filter((r) => r.status === "testing").length;

const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|wav)(\?|#|$)/i;
const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|webm)(\?|#|$)/i;
const PDF_EXTENSION = /\.pdf(\?|#|$)/i;

/**
 * Structural validation. Pure and offline — no network access.
 * Returns a list of human-readable problems (empty means valid).
 */
export function validateResourceManifest(chapterIds: string[] = MANIFEST_CHAPTER_IDS): string[] {
  const errors: string[] = [];
  const known = new Set(chapterIds);
  const seenIds = new Set<string>();

  for (const resource of resourceManifest) {
    if (seenIds.has(resource.resourceId)) {
      errors.push(`Duplicate resourceId: ${resource.resourceId}`);
    }
    seenIds.add(resource.resourceId);

    if (!known.has(resource.chapterId)) {
      errors.push(`Unknown chapterId "${resource.chapterId}" for ${resource.resourceId}`);
    }

    const active = resource.status === "available" || resource.status === "testing";
    if (active && !resource.url?.trim()) {
      errors.push(`${resource.resourceId} is ${resource.status} but has no URL`);
    }
    if (!active && resource.url) {
      errors.push(`${resource.resourceId} is ${resource.status} but exposes a fallback URL`);
    }

    if (resource.url) {
      if (resource.kind === "pdf" && AUDIO_EXTENSIONS.test(resource.url)) {
        errors.push(`${resource.resourceId} is a PDF resource pointing at an audio file`);
      }
      if (resource.kind === "audio" && PDF_EXTENSION.test(resource.url)) {
        errors.push(`${resource.resourceId} is an audio resource pointing at a PDF file`);
      }
      if (resource.kind === "audio" && VIDEO_EXTENSIONS.test(resource.url)) {
        errors.push(`${resource.resourceId} is an audio resource pointing at a video file`);
      }
      if (resource.kind === "video" && (PDF_EXTENSION.test(resource.url) || AUDIO_EXTENSIONS.test(resource.url))) {
        errors.push(`${resource.resourceId} is a video resource pointing at a non-video file`);
      }
    }
  }

  for (const chapterId of chapterIds) {
    const activePdfs = pdfResources.filter((r) => r.chapterId === chapterId && isActive(r));
    const activeAudio = audioResources.filter((r) => r.chapterId === chapterId && isActive(r));
    if (activePdfs.length > 1) errors.push(`${chapterId} has ${activePdfs.length} active PDF resources`);
    if (activeAudio.length > 1) errors.push(`${chapterId} has ${activeAudio.length} active audio resources`);
  }

  // --- MediaTrack relationships -------------------------------------------
  const seenTrackIds = new Set<string>();
  const orderByChapter = new Map<string, Set<number>>();
  for (const track of mediaTracks) {
    if (seenTrackIds.has(track.trackId)) errors.push(`Duplicate trackId: ${track.trackId}`);
    seenTrackIds.add(track.trackId);

    if (!known.has(track.chapterId)) {
      errors.push(`Unknown chapterId "${track.chapterId}" for track ${track.trackId}`);
    }
    if (!Number.isInteger(track.order) || track.order < 1) {
      errors.push(`${track.trackId} has a non-positive order`);
    }
    const orders = orderByChapter.get(track.chapterId) ?? new Set<number>();
    if (orders.has(track.order)) {
      errors.push(`${track.chapterId} has two tracks with order ${track.order}`);
    }
    orders.add(track.order);
    orderByChapter.set(track.chapterId, orders);

    if (!track.audioResourceId && !track.videoResourceId) {
      errors.push(`${track.trackId} declares neither an audio nor a video rendition`);
    }

    const renditions: Array<["audio" | "video", string | undefined]> = [
      ["audio", track.audioResourceId],
      ["video", track.videoResourceId],
    ];
    for (const [kind, resourceId] of renditions) {
      if (!resourceId) continue;
      const resource = resourceManifest.find((r) => r.resourceId === resourceId);
      if (!resource) {
        errors.push(`${track.trackId} references unknown ${kind} resource ${resourceId}`);
        continue;
      }
      if (resource.kind !== kind) {
        errors.push(`${track.trackId} references ${resourceId} as ${kind} but it is a ${resource.kind}`);
      }
      if (resource.chapterId !== track.chapterId) {
        errors.push(
          `${track.trackId} references ${resourceId} from ${resource.chapterId}, not ${track.chapterId}`,
        );
      }
    }

    // At most one ACTIVE rendition per kind per track is structural: the model
    // holds a single optional resourceId for each kind, so a duplicate can only
    // appear as two manifest rows sharing the same id (checked above).
  }

  // A resource may belong to at most one track.
  const ownerByResource = new Map<string, string>();
  for (const track of mediaTracks) {
    for (const resourceId of [track.audioResourceId, track.videoResourceId]) {
      if (!resourceId) continue;
      const owner = ownerByResource.get(resourceId);
      if (owner) errors.push(`${resourceId} is claimed by both ${owner} and ${track.trackId}`);
      ownerByResource.set(resourceId, track.trackId);
    }
  }

  // Chapters 2–29 must never inherit the Chapter 1 test resources.
  const ch01Pdf = getPdfResource("ch-01")?.url;
  const ch01Audio = getAudioResource("ch-01")?.url;
  for (const chapterId of chapterIds) {
    if (chapterId === "ch-01") continue;
    if (ch01Pdf && getPdfResource(chapterId)?.url === ch01Pdf) {
      errors.push(`${chapterId} inherits the Chapter 1 test PDF`);
    }
    if (ch01Audio && getAudioResource(chapterId)?.url === ch01Audio) {
      errors.push(`${chapterId} inherits the Chapter 1 test audio`);
    }
  }

  return errors;
}

/** Throws when the manifest is structurally invalid (used at build time). */
export function assertResourceManifest(chapterIds: string[] = MANIFEST_CHAPTER_IDS): void {
  const errors = validateResourceManifest(chapterIds);
  if (errors.length > 0) {
    throw new Error(`Invalid resource manifest:\n- ${errors.join("\n- ")}`);
  }
}
