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
- `ChapterProgress.resourceRatio` in the current demo data is a placeholder and
  **must NOT be treated as real audio progress in Sprint 2**.
