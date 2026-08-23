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
