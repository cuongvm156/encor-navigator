# Architecture

## Actual stack (as implemented)

- React 19
- TypeScript
- Vite
- TanStack Start
- TanStack Router (file-based routing under `src/routes`)
- Tailwind CSS
- shadcn/ui
- lucide-react

### Approved deviation

The original proposal specified **React Router**. The project template ships with
**TanStack Start / TanStack Router**, and this is recorded as an **approved
deviation**. Do not introduce `react-router-dom`.

## Principles

- **Local-first.** The app must be fully usable offline with no backend.
- **IndexedDB through Dexie** is the primary user-data store (implemented in
  Sprint 2A: `ENCORStudyDB` v1, created lazily in the browser only; UI is not
  wired to it yet).
- **No mandatory backend.** No Supabase, no auth, no cloud sync in V1.
- **HTMLAudioElement is the primary audio playback engine.** No Web Audio API and
  no third-party player libraries without explicit approval.
- **Media Session API** provides iPhone lock-screen / control-center controls.
- **PDF.js** will be used later for PDF rendering (not in V1 UI).
- **UI components must not touch IndexedDB directly.** All user state flows
  through service / repository layers.
- **Never reset local user data on application upgrade.** Use versioned schemas
  and explicit migrations.
- **Course content stays data-driven** (typed Course / Part / Chapter / Resource
  models), never hard-coded JSX.
- The runtime must remain usable **without Lovable, Cursor, Codex, Supabase or
  any paid service**.

## Layering

```text
routes / components      (presentation only)
        |
   feature modules       src/features/*  (audio controller, progress weights)
        |
   repositories          src/repositories/*  (typed user-state access)
        |
   database              src/db/*  (Dexie schema + versioning)
```

## Directory map

| Path | Purpose |
| --- | --- |
| `src/routes` | TanStack Router file-based routes (8 logical screens) |
| `src/components/layout` | App shell, nav, page header |
| `src/features/course` | Typed course models, demo data, derived values |
| `src/features/progress` | Central 60/40 progress weighting |
| `src/features/audio` | Audio controller + Media Session boundary (skeleton) |
| `src/db` | Dexie database + schema/versioning (skeleton) |
| `src/repositories` | Reading / playback / progress repositories (skeleton) |

## Progress model

Reading and audio progress are independent and stored separately; see `PRD.md`
for the `ReadingState` and `PlaybackState` shapes. `resourceRatio` in the demo
data is not real audio progress.
