# Backup & Restore Guide (Sprint 5A)

ENCOR Navigator keeps all of your learning data on your own device. A backup
lets you move that data to a new iPhone, browser or computer.

## What a backup includes

- Reading progress: `chapterId`, `pdfResourceId`, `lastPage`, `maxPageReached`, `updatedAt`
- Audio progress: `chapterId`, `audioResourceId`, `currentTime`, `maxPosition`, `duration` (when measured), `updatedAt`
- Reader notes (plain text)
- Reader bookmarks
- A small allow-list of preferences (playback speed, repeat preference, seek interval, reader zoom, UI theme)

## What a backup never includes

- PDF files and audio files
- Cache Storage entries and Service Worker caches
- Offline resource metadata, resource URLs and the resource manifest
- Authentication data, credentials, secrets
- Debug logs or browser/device information

Nothing is uploaded anywhere. The file is created locally and handed to you.

## Backup format

```json
{
  "format": "encor-navigator-backup",
  "formatVersion": 1,
  "appVersion": "1.0.0",
  "courseId": "encor-350-401-v2",
  "exportedAt": "2026-08-23T12:00:00.000Z",
  "data": {
    "readingProgress": [],
    "audioProgress": [],
    "notes": [],
    "bookmarks": [],
    "settings": {}
  }
}
```

File name: `encor-navigator-backup-YYYY-MM-DD-HHmm.json`

## Exporting on iPhone

1. Open **Settings → Backup & Restore**.
2. Tap **Export backup**.
3. The iOS share sheet opens (Web Share API with a JSON file).
4. Choose **Save to Files**, then pick **iCloud Drive** or **On My iPhone**.

If the share sheet is unavailable, the browser downloads the file instead; find
it in **Files → Downloads** and move it to iCloud Drive manually.

Exporting never changes your learning data — only the "last backup" timestamp
is recorded on the device.

## Restoring on another device

1. Install / open ENCOR Navigator on the new device.
2. Open **Settings → Backup & Restore → Restore from backup**.
3. Pick the `.json` backup file.
4. Review the restore preview (records found, new vs merged) and tap
   **Restore and merge**.

Existing data is never cleared or replaced. Sprint 5A intentionally offers no
"Replace all" or "Clear data" option.

## Why PDFs and audio must be downloaded again

Backups exclude all media binaries for copyright and size reasons. After a
restore, open **Offline** and download or import the PDF/audio you need on the
new device. Progress, notes and bookmarks re-attach automatically because they
are keyed by `pdfResourceId` / `audioResourceId`.

## Merge rules

The whole restore runs inside one Dexie transaction. If any write fails the
entire restore rolls back and existing data is untouched.

- **Reading progress** — matched by `pdfResourceId`. `maxPageReached` becomes the
  maximum of existing and backup (never reduced). `lastPage` comes from the record
  with the newer `updatedAt`. Progress is never transferred between different
  `pdfResourceId` values. `lastPage` is clamped only once the real PDF page count
  is known in the reader.
- **Audio progress** — matched by `audioResourceId`. `maxPosition` becomes the
  maximum of existing and backup (never reduced). `currentTime` comes from the
  newer record. Progress never crosses resource identities.
- **Notes** — matched by note id; the newer `updatedAt` wins. Different ids are
  both kept. Note bodies are never merged automatically.
- **Bookmarks** — deduplicated by `pdfResourceId` + `pageNumber`; the newer record wins.
- **Settings** — only allow-listed keys are imported; unknown keys are ignored.
  Backup data can never change the database schema, resource manifest or routes.

Re-importing the same backup produces no duplicates.

## Privacy

Backups contain only your own study progress and your own notes. Treat the file
as personal data: it is readable plain JSON. Imported note text is always
rendered as plain text and never as HTML, and is never executed.

## Version compatibility

- `format` must be `encor-navigator-backup`.
- `formatVersion` 1 is supported. A newer version is rejected with a clear message.
- `courseId` must be `encor-350-401-v2` (9 parts / 29 chapters).
- Files larger than 5 MB, malformed JSON, unsafe keys (`__proto__`,
  `constructor`, `prototype`), excessive nesting or invalid numeric/timestamp
  fields are rejected before anything is written.

## Backup history stored on device

Only `lastBackupAt`, `lastRestoreAt`, the last restored file name and the last
restore result counts. Backup JSON is never stored inside IndexedDB.
