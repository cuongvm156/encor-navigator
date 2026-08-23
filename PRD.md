# PRD — ENCOR Study (MVP V1)

## Product

Personal **CCNP ENCOR 350-401 Study PWA**.

- **Local-first**: all user data lives on the device.
- **Target runtime cost**: $0 / month (no paid services required).
- **Primary platforms**: iPhone installed PWA and desktop browser.
- Single-user, personal-use application. No multi-tenancy, no accounts.

## MVP V1 logical screens

| ID | Screen |
| --- | --- |
| S01 | Dashboard |
| S02 | Learn / Course |
| S03 | Chapter Detail |
| S04 | PDF Reader |
| S05 | Audio Player |
| S06 | Notes & Bookmarks |
| S07 | Progress |
| S08 | Settings |

No top-level Search or Resources screens. Resources live inside Chapter Detail.

## Course catalogue (Sprint 3C)

Source of truth: *CCNP and CCIE Enterprise Core ENCOR 350-401 Official Cert
Guide, 2nd Edition*.

- **9 book Parts**: Forwarding, Layer 2, Routing, Services, Overlay, Wireless,
  Architecture, Security, SDN.
- **29 technical Chapters** (`ch-01` … `ch-29`).
- **Chapter 30 (Final Preparation)** and **Chapter 31 (ENCOR 350-401 Exam
  Updates)** are outside the approved application scope and are not counted in
  course progress.
- Unconfirmed metadata (exam weights, study minutes, page counts, audio
  durations, summaries, objectives) is **not fabricated**. Those fields are
  optional and their UI rows are hidden when unavailable.
- All Part/Chapter counters are derived from the data arrays, never hardcoded.

## V1 core functionality planned

- Course / Part / Chapter tracking
- PDF reading progress and resume
- MP3 playback and resume
- iPhone lock-screen playback
- Notes
- Bookmarks
- Progress
- Local persistence
- Backup / Restore

## Out of scope until later

- Quiz
- Flashcards
- Labs
- Mock Exam
- Weak Topics
- AI Tutor
- Cloud sync
- Supabase authentication
- Video player

## Progress model (future, real data)

Reading and audio progress are tracked **independently**.

```ts
interface ReadingState {
  lastPage: number;       // resume point
  maxPageReached: number; // progress measure
}

interface PlaybackState {
  currentTime: number;    // resume point
  maxPosition: number;    // progress measure
  duration: number;
  playbackRate: number;
  repeatMode: "off" | "once" | "lesson";
  updatedAt: string;      // ISO timestamp
}
```

- Reading **progress** = `maxPageReached / totalPages`; **resume** = `lastPage`.
- Audio **progress** = `maxPosition / duration`; **resume** = `currentTime`.
- Overall chapter completion stays centrally weighted: **60% reading / 40% audio**.
- `ChapterProgress.resourceRatio` is a legacy placeholder and **must NOT be
  treated as real audio progress**. Demo progress/notes/resources were removed
  in Sprint 3C; real state lives in IndexedDB.
