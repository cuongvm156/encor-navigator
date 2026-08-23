# Resource Guide — PDFs and Audio

All chapter documents and audio files are declared in one place:

`src/data/resourceManifest.ts`

Reader, Audio, Chapter Detail, Dashboard and Settings read availability from the
manifest selectors, so adding or replacing a file never requires editing feature
code.

## Rules

- **One chapter per PDF file.** A chapter may have at most one active PDF and one
  active audio resource.
- **No fallbacks.** A chapter without its own resource shows "unavailable" and
  must never inherit another chapter's file.
- **No fabricated metadata.** Page counts, durations and file sizes are never
  stored in the catalogue.

## File locations

- PDFs: `public/pdfs/`  → served at `/pdfs/<file>.pdf`
- Audio: `public/audio/` → served at `/audio/<file>.mp3`

Remote URLs (e.g. the temporary demo audio) are allowed for testing resources.

## Naming convention

| Item            | Pattern                              |
| --------------- | ------------------------------------ |
| PDF resourceId  | `encor-v2-chXX-short-title-v1`       |
| Audio resourceId| `encor-v2-chXX-audio-v1`             |
| PDF file name   | `encor-v2-chXX-short-title.pdf`      |
| Audio file name | `encor-v2-chXX-short-title.mp3`      |

Chapter numbers are zero-padded: `ch01` … `ch29`.

## Adding a resource

1. Copy the file into `public/pdfs/` or `public/audio/`.
2. Replace the chapter's `unavailable` entry in `pdfResources` / `audioResources`
   with:

```ts
{
  resourceId: "encor-v2-ch02-spanning-tree-v1",
  chapterId: "ch-02",
  kind: "pdf",
  status: "available",
  url: "/pdfs/encor-v2-ch02-spanning-tree.pdf",
  fileName: "encor-v2-ch02-spanning-tree.pdf",
  version: 1,
}
```

3. Run `npm run validate:resources`, then `npm run build`.

## Replacing a temporary resource with the official one

Chapter 1 currently uses the temporary test document `test-clcor-ch01-v1`.
When the official PDF arrives:

- Add a **new** entry with `resourceId: "encor-v2-ch01-packet-forwarding-v1"`.
- Set the old entry's status to `archived` and remove its `url`.
- Never reuse `test-clcor-ch01-v1`.

## Why the resourceId must change

Reading progress, notes and bookmarks are keyed by `pdfResourceId` + page number.
A different document has a different page structure (19 pages vs. 34 pages), so
reusing the id would attach existing annotations to unrelated pages. A new
resourceId starts a clean reading state at page 1 while the old records stay
untouched in IndexedDB.

## Page counts

Total pages always come from PDF.js (`numPages`) at load time. Reading progress
is `maxPageReached / actual numPages`; `lastPage` and `?page=` deep links are
clamped to the real page count.

## Marking a resource unavailable

Set `status: "unavailable"` and remove `url`. The UI then shows
"PDF unavailable" / "Audio unavailable" and hides the open/playback controls.

## Validation and build

```bash
npm run validate:resources   # offline structural checks
npm run build                # validates first, then builds
```

Validation checks unique resourceIds, known chapterIds, at most one active PDF
and audio per chapter, URLs present for available/testing entries, no URL on
unavailable/archived entries, no PDF/audio URL mix-ups, and that chapters 2–29
never inherit the Chapter 1 test resources.

## Offline downloads and local import (Sprint 4B)

### Where files live

| Layer | Contents |
| --- | --- |
| Cache Storage `encor-offline-resources-v1` | the binary PDF / audio bytes |
| IndexedDB `offlineResources` (DB v3) | searchable metadata: chapter, kind, status, source, size, file name |
| Service worker `/sw.js` + `/offline-resources-sw.js` | serves `/__offline-resources/<resourceId>` (with HTTP Range for iOS audio seeking) |

`DB_VERSION` moved 2 → 3 additively: no existing store is modified, and no
progress, playback state, note or bookmark is migrated, rewritten or deleted.

### Resolution order

Reader and Audio call `useResolvedResource(chapterId, kind)`:

1. ready **local import** for the chapter
2. ready **download** of the manifest resource
3. **online** manifest URL
4. **unavailable**

A local import receives its own `local-<chapterId>-<kind>-<timestamp>`
resourceId, so its reading progress, notes and bookmarks are stored separately
from the manifest document — exactly like any other document identity change.

### Rules

- Nothing downloads automatically; every download and import is user-initiated.
- Downloads are cancellable; a cancelled, incomplete or invalid body is never
  kept — the metadata row and the cache entry are removed together.
- PDFs must start with `%PDF`; audio must decode in a real `HTMLAudioElement`.
- Removing an offline file deletes only that binary and its metadata row.
- Copyrighted Cisco Press files never leave the device: imports are read in the
  browser, and `.gitignore` blocks `*.pdf`, `public/pdfs/*` and audio binaries.
- On startup, metadata is reconciled with Cache Storage; a `ready` row without a
  cached binary is downgraded to `error` instead of silently failing later.
- In dev and Lovable preview no service worker is registered (per platform
  rules), so offline binaries are served through a temporary object URL that is
  revoked on cleanup. The `/__offline-resources/` route is active in the
  published app only.

## Media tracks and video renditions (Sprint 6A.1)

A **MediaTrack** is one logical learning item inside a chapter. Its MP3 and MP4
are two renditions of the same item and share one progress/resume state.

```ts
{
  trackId: "ch01-track01",
  chapterId: "ch-01",
  order: 1,
  title: "Technical test track 1 (demo audio)",
  audioResourceId: "demo-audio-ch01",
  videoResourceId: "ch01-track01-video-v1",
}
```

Rules:

- Track ids are stable and unique; `order` is unique inside a chapter.
- A rendition resource belongs to exactly one track and one chapter — no
  fallback and no inheritance between tracks or chapters.
- Video files live in `public/video/` (`/video/<file>.mp4`) when published, or
  are imported locally on the device. **No MP4 is committed to this repository**
  and no chapter media metadata, duration or file size is ever invented.
- Progress is stored once, as a ratio, in `mediaTrackStates` (DB v4). Switching
  rendition seeks to `resumeRatio * duration` of the new rendition.
- Removing an offline video deletes only that binary and its metadata row.
