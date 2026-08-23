/**
 * Sprint 6A.1 acceptance tests — track-scoped media resolution, playlist order,
 * shared progress and backup compatibility.
 *
 * Pure logic only, driven by in-memory FIXTURE MediaTracks. No fake runtime
 * course content is added to the app, no network and no browser is required.
 * Run with: npm run test:media
 */

import { readFileSync } from "node:fs";

import type { MediaTrack } from "../src/data/resourceManifest.ts";
import type { MediaTrackState, OfflineResourceRecord } from "../src/db/schema.ts";
import {
  buildPlaylist,
  neighbours,
  nextInChapter,
  resolveChapterTracks,
  resolveTrackById,
} from "../src/features/media/tracks.ts";
import { chapterMediaRatio } from "../src/features/media/mediaProgress.ts";
import { mergeMaxRatio, renditionResumeSeconds } from "../src/features/media/progressRules.ts";
import {
  SWITCH_INTENT_TTL_MS,
  clearRenditionSwitch,
  consumeRenditionSwitch,
  peekRenditionSwitch,
  requestRenditionSwitch,
} from "../src/features/media/switchIntent.ts";
import { validateBackupText } from "../src/features/backup/validate.ts";
import { BACKUP_FORMAT, BACKUP_COURSE_ID } from "../src/features/backup/format.ts";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failures += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------- fixtures
const iso = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString();

const fixtureTracks: Record<string, MediaTrack[]> = {
  "fx-01": [
    {
      trackId: "fx01-t1",
      chapterId: "fx-01",
      order: 1,
      title: "Fixture track 1",
      audioResourceId: "fx01-t1-audio",
      videoResourceId: "fx01-t1-video",
    },
    {
      trackId: "fx01-t2",
      chapterId: "fx-01",
      order: 2,
      title: "Fixture track 2",
      audioResourceId: "fx01-t2-audio",
      videoResourceId: "fx01-t2-video",
    },
  ],
  "fx-02": [
    {
      trackId: "fx02-t1",
      chapterId: "fx-02",
      order: 1,
      title: "Fixture chapter 2 track",
      audioResourceId: "fx02-t1-audio",
      videoResourceId: "fx02-t1-video",
    },
  ],
  // Legacy chapter: one track, offline rows written before v5 (no trackId).
  "fx-legacy": [
    {
      trackId: "legacy-t1",
      chapterId: "fx-legacy",
      order: 1,
      title: "Legacy single track",
      audioResourceId: "legacy-audio",
    },
  ],
};
const tracksOf = (chapterId: string) => fixtureTracks[chapterId] ?? [];

const row = (input: Partial<OfflineResourceRecord> & { resourceId: string; chapterId: string; kind: OfflineResourceRecord["kind"] }): OfflineResourceRecord => ({
  id: input.resourceId,
  sourceType: "local-import",
  status: "ready",
  offlineUrl: `/__offline-resources/${input.resourceId}`,
  updatedAt: iso(1),
  ...input,
});

const importedVideos: OfflineResourceRecord[] = [
  row({
    resourceId: "local-fx-01-fx01-t1-video-1",
    chapterId: "fx-01",
    kind: "video",
    trackId: "fx01-t1",
    targetResourceId: "fx01-t1-video",
    originalFileName: "track-1.mp4",
    updatedAt: iso(1),
  }),
  row({
    resourceId: "local-fx-01-fx01-t2-video-2",
    chapterId: "fx-01",
    kind: "video",
    trackId: "fx01-t2",
    targetResourceId: "fx01-t2-video",
    originalFileName: "track-2.mp4",
    updatedAt: iso(2),
  }),
  row({
    resourceId: "local-fx-01-fx01-t1-audio-1",
    chapterId: "fx-01",
    kind: "audio",
    trackId: "fx01-t1",
    targetResourceId: "fx01-t1-audio",
    updatedAt: iso(3),
  }),
  row({
    resourceId: "local-fx-02-audio",
    chapterId: "fx-02",
    kind: "audio",
    trackId: "fx02-t1",
    targetResourceId: "fx02-t1-audio",
    updatedAt: iso(4),
  }),
];

// ------------------------------------------- 1. distinct imports per track
{
  const resolved = resolveChapterTracks(importedVideos, "fx-01", tracksOf("fx-01"));
  const [t1, t2] = resolved;
  check(
    "two tracks in one chapter resolve DISTINCT imported videos",
    t1!.video.resourceId === "local-fx-01-fx01-t1-video-1" &&
      t2!.video.resourceId === "local-fx-01-fx01-t2-video-2",
    `${t1!.video.resourceId} / ${t2!.video.resourceId}`,
  );
  check(
    "a video imported for Track 01 never appears for Track 02",
    t1!.video.url !== t2!.video.url,
  );
  check(
    "audio of Track 01 is track-scoped and Track 02 audio stays unavailable",
    t1!.audio.resourceId === "local-fx-01-fx01-t1-audio-1" &&
      t2!.audio.origin === "unavailable",
    `${t1!.audio.resourceId} / ${t2!.audio.origin}`,
  );
}

// ------------------------------- 2. removing Track 01 does not affect Track 02
{
  const afterRemoval = importedVideos.filter(
    (r) => r.resourceId !== "local-fx-01-fx01-t1-video-1",
  );
  const resolved = resolveChapterTracks(afterRemoval, "fx-01", tracksOf("fx-01"));
  check(
    "removing Track 01 video leaves Track 02 video intact",
    resolved[0]!.video.origin === "unavailable" &&
      resolved[1]!.video.resourceId === "local-fx-01-fx01-t2-video-2",
  );
  check(
    "removing Track 01 video keeps the paired Track 01 audio",
    resolved[0]!.audio.resourceId === "local-fx-01-fx01-t1-audio-1",
  );
  check(
    "removing a media row never touches PDF rows",
    afterRemoval.every((r) => r.kind !== "pdf"),
  );
}

// -------------------------------------------- 3. /video uses the exact track
{
  const requested = resolveTrackById(importedVideos, "fx-01", "fx01-t2", tracksOf("fx-01"));
  check(
    "/video resolves the EXACT requested track",
    requested?.track.trackId === "fx01-t2" &&
      requested.video.resourceId === "local-fx-01-fx01-t2-video-2",
  );
  const unknown = resolveTrackById(importedVideos, "fx-01", "does-not-exist", tracksOf("fx-01"));
  check("/video rejects an unknown trackId", unknown === undefined);
}

// ------------------------------------- 4. /audio optional track deep linking
{
  const tracks = resolveChapterTracks(importedVideos, "fx-01", tracksOf("fx-01"));
  const withoutParam = tracks[0];
  const withParam = resolveTrackById(importedVideos, "fx-01", "fx01-t2", tracksOf("fx-01"));
  check(
    "/audio?chapter=… (no track) keeps the first declared track",
    withoutParam!.track.trackId === "fx01-t1",
  );
  check(
    "/audio?chapter=…&track=… selects that exact track",
    withParam!.track.trackId === "fx01-t2",
  );
}

// --------------------------------------------------- 5. playlist and order
{
  const chapterIds = ["fx-01", "fx-02", "fx-legacy"];
  const legacyRows: OfflineResourceRecord[] = [
    ...importedVideos,
    // pre-v5 row: no trackId, no targetResourceId
    row({
      resourceId: "local-fx-legacy-audio-0",
      chapterId: "fx-legacy",
      kind: "audio",
      updatedAt: iso(5),
    }),
  ];
  const playlist = buildPlaylist(legacyRows, chapterIds, { mode: "audio", tracksOf });
  check(
    "audio playlist follows tracks inside a chapter, then the next chapter",
    JSON.stringify(playlist) ===
      JSON.stringify([
        { chapterId: "fx-01", trackId: "fx01-t1" },
        { chapterId: "fx-02", trackId: "fx02-t1" },
        { chapterId: "fx-legacy", trackId: "legacy-t1" },
      ]),
    JSON.stringify(playlist),
  );

  const videoPlaylist = buildPlaylist(legacyRows, chapterIds, { mode: "video", tracksOf });
  const { previous, next } = neighbours(videoPlaylist, "fx-01", "fx01-t2");
  check(
    "Previous/Next move between tracks of the same chapter first",
    previous?.trackId === "fx01-t1" && next === undefined,
    JSON.stringify(videoPlaylist),
  );
  const acrossChapters = neighbours(playlist, "fx-01", "fx01-t1");
  check(
    "Next crosses into the following chapter at the end of a chapter",
    acrossChapters.next?.chapterId === "fx-02",
  );
  check(
    "Repeat Lesson wraps inside the chapter only",
    nextInChapter(videoPlaylist, "fx-01", "fx01-t2")?.trackId === "fx01-t1",
  );
}

// ---------------------------------- 6. legacy chapter-only offline behaviour
{
  const legacyRow = row({
    resourceId: "local-fx-legacy-audio-0",
    chapterId: "fx-legacy",
    kind: "audio",
    updatedAt: iso(5),
  });
  const single = resolveChapterTracks([legacyRow], "fx-legacy", tracksOf("fx-legacy"));
  check(
    "legacy chapter-wide audio still resolves for a single-track chapter",
    single[0]!.audio.resourceId === "local-fx-legacy-audio-0" &&
      single[0]!.audio.origin === "local-import-legacy",
  );

  const ambiguous = resolveChapterTracks(
    [{ ...legacyRow, chapterId: "fx-01" }],
    "fx-01",
    tracksOf("fx-01"),
  );
  check(
    "an ambiguous legacy row is NEVER assigned when the chapter has 2 tracks",
    ambiguous.every((entry) => entry.audio.origin !== "local-import-legacy"),
  );
}

// ------------------------------------- 7. shared progress: monotonic, once
{
  check("maxRatio never decreases", mergeMaxRatio(0.8, 0.2) === 0.8);
  check("maxRatio grows with new progress", mergeMaxRatio(0.2, 0.55) === 0.55);
  check("maxRatio is clamped to 0..1", mergeMaxRatio(undefined, 5) === 1);

  // Listen to 50% (audio), then watch the same track to 50% (video):
  // one shared row, so the chapter must stay at 50%, not 100%.
  let shared = mergeMaxRatio(undefined, 0.5); // audio pass
  shared = mergeMaxRatio(shared, 0.5); // video pass over the same material
  const states: MediaTrackState[] = [
    {
      id: "fx-02:fx02-t1",
      chapterId: "fx-02",
      trackId: "fx02-t1",
      currentMode: "video",
      resumeRatio: 0.5,
      maxRatio: shared,
      audioDuration: 600,
      videoDuration: 600,
      updatedAt: iso(6),
    },
  ];
  check(
    "audio then video does not double-count",
    chapterMediaRatio("fx-02", states, tracksOf("fx-02")) === 0.5,
  );

  const twoTrackStates: MediaTrackState[] = [
    { ...states[0]!, id: "fx-01:fx01-t1", chapterId: "fx-01", trackId: "fx01-t1", maxRatio: 1 },
  ];
  check(
    "an unplayed second track contributes 0 and no duration is invented",
    chapterMediaRatio("fx-01", twoTrackStates, tracksOf("fx-01")) === 0.5,
  );

  check(
    "resume maps through the ratio into the target rendition duration",
    renditionResumeSeconds(0.25, 480) === 120,
  );
}

// ------------------------------------------------ 8. backup compatibility
{
  const v1 = JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: 1,
    appVersion: "1.0.0",
    courseId: BACKUP_COURSE_ID,
    exportedAt: iso(7),
    data: {
      readingProgress: [
        {
          chapterId: "ch-01",
          pdfResourceId: "test-clcor-ch01-v1",
          lastPage: 3,
          maxPageReached: 7,
          updatedAt: iso(7),
        },
      ],
      audioProgress: [],
      notes: [],
      bookmarks: [],
      settings: {},
    },
  });
  const parsed = validateBackupText(v1);
  check("a v1 backup (no mediaTracks) is still importable", parsed.ok === true, JSON.stringify(parsed));

  const v2 = JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: 2,
    appVersion: "1.0.0",
    courseId: BACKUP_COURSE_ID,
    exportedAt: iso(8),
    data: {
      readingProgress: [],
      audioProgress: [],
      notes: [],
      bookmarks: [],
      mediaTracks: [
        {
          chapterId: "fx-01",
          trackId: "fx01-t1",
          currentMode: "video",
          resumeRatio: 0.4,
          maxRatio: 0.6,
          updatedAt: iso(8),
        },
      ],
      settings: {},
    },
  });
  const parsedV2 = validateBackupText(v2);
  const payload = parsedV2.ok ? parsedV2.payload : undefined;
  check("a v2 backup with shared MediaTrack ratios is importable", Boolean(payload));
  const keys = payload ? Object.keys(payload.data).sort().join(",") : "";
  check(
    "a backup never carries binaries or offline resource metadata",
    keys === "audioProgress,bookmarks,mediaTracks,notes,readingProgress,settings",
    keys,
  );
  check(
    "restored media state is ratios only (no URL, blob or file name)",
    JSON.stringify(payload?.data.mediaTracks ?? []).match(/blob|http|offline|fileName/i) === null,
  );
}

// ------------------------------- 9. one-shot rendition switch intent (no autoplay)
{
  clearRenditionSwitch();
  check(
    "no intent exists by default (a plain URL open never autoplays)",
    consumeRenditionSwitch("fx-01", "fx01-t1", "video") === false,
  );

  requestRenditionSwitch({ chapterId: "fx-01", trackId: "fx01-t1", mode: "video" });
  check(
    "an intent for another track is rejected",
    consumeRenditionSwitch("fx-01", "fx01-t2", "video") === false,
  );
  check(
    "an intent for another chapter is rejected",
    consumeRenditionSwitch("fx-02", "fx01-t1", "video") === false,
  );
  check(
    "an intent for the other rendition mode is rejected",
    consumeRenditionSwitch("fx-01", "fx01-t1", "audio") === false,
  );
  check(
    "the exact chapter + track + mode consumes the intent",
    consumeRenditionSwitch("fx-01", "fx01-t1", "video") === true,
  );
  check(
    "the intent is one-shot (a refresh or Back/Forward gets nothing)",
    consumeRenditionSwitch("fx-01", "fx01-t1", "video") === false,
  );

  const t0 = 1_000_000;
  requestRenditionSwitch({ chapterId: "fx-02", trackId: "fx02-t1", mode: "audio" }, t0);
  check(
    "an intent expires after its TTL",
    consumeRenditionSwitch("fx-02", "fx02-t1", "audio", t0 + SWITCH_INTENT_TTL_MS + 1) === false,
  );
  check("an expired intent is dropped", peekRenditionSwitch(t0 + SWITCH_INTENT_TTL_MS + 1) === undefined);

  requestRenditionSwitch({ chapterId: "fx-02", trackId: "fx02-t1", mode: "audio" }, t0);
  check(
    "an intent within its TTL is still valid",
    consumeRenditionSwitch("fx-02", "fx02-t1", "audio", t0 + 500) === true,
  );

  requestRenditionSwitch({ chapterId: "fx-01", trackId: "fx01-t1", mode: "video" });
  clearRenditionSwitch();
  check(
    "leaving the switch flow clears the intent",
    consumeRenditionSwitch("fx-01", "fx01-t1", "video") === false,
  );
  check(
    "consuming with an unknown track id is rejected",
    (() => {
      requestRenditionSwitch({ chapterId: "fx-01", trackId: "fx01-t1", mode: "video" });
      const rejected = consumeRenditionSwitch("fx-01", undefined, "video") === false;
      clearRenditionSwitch();
      return rejected;
    })(),
  );
}

// ------------------------------------- 10. route search schemas: no autoplay
{
  const audioRoute = readFileSync(new URL("../src/routes/audio.tsx", import.meta.url), "utf8");
  const videoRoute = readFileSync(new URL("../src/routes/video.tsx", import.meta.url), "utf8");
  check("/audio search schema no longer accepts autoplay", !/autoplay/i.test(audioRoute));
  check("/video search schema no longer accepts autoplay", !/autoplay/i.test(videoRoute));
  check(
    "the switch actions navigate with chapter + track only",
    /search: \{ chapter: current\.id, track: activeTrackId \}/.test(audioRoute) &&
      /search: \{ chapter: chapter\.id, track: resolved\.track\.trackId \}/.test(videoRoute),
  );
}

if (failures > 0) {
  console.error(`\n${failures} media-track test(s) failed.`);
  process.exit(1);
}
console.log("\nAll media-track tests passed.");
