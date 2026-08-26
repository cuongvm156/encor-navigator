import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Clock, Headphones } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chapters, course, parts, resources } from "@/features/course/data";
import { hasAudio } from "@/features/audio/sources";
import { pickContinueReading, useLiveProgress } from "@/features/progress/useLiveProgress";
import {
  audioRatioOf,
  averageCompletion,
  chapterCompletion,
  partCompletion,
  readingRatioOf,
  toPercent,
} from "@/features/progress/weights";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ENCOR Study — CCNP 350-401 Study Dashboard" },
      {
        name: "description",
        content:
          "Track your CCNP ENCOR 350-401 reading and audio progress, continue where you left off, and plan today's study session.",
      },
      { property: "og:title", content: "ENCOR Study — CCNP 350-401 Study Dashboard" },
      {
        property: "og:description",
        content: "Continue reading, continue listening, and track your CCNP ENCOR 350-401 progress.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { progressById, readingStates } = useLiveProgress();
  const overall = averageCompletion(chapters, progressById);
  const recents = chapters
    .filter((c) => progressById[c.id]?.lastOpened)
    .sort((a, b) =>
      (progressById[b.id]?.lastOpened ?? "").localeCompare(progressById[a.id]?.lastOpened ?? ""),
    )
    .slice(0, 4);

  // Most recently updated readable chapter from persisted reading progress.
  const { chapter: continueReading, lastPage } = pickContinueReading(readingStates);

  const audioChapters = chapters.filter((c) => hasAudio(c, resources));
  const continueListening =
    audioChapters.find((c) => {
      const r = audioRatioOf(progressById[c.id]);
      return r > 0 && r < 1;
    }) ?? audioChapters[0];

  const studyToday = chapters
    .filter((c) => chapterCompletion(progressById[c.id]) < 1)
    .slice(0, 3);
  const todayMinutes = studyToday.reduce((sum, c) => sum + (c.minutes ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow={`${course.vendor} · ${course.code}`}
        title="ENCOR Study"
        description={course.description}
      />

      <section className="rounded-lg border border-border p-5">
        <ProgressBar ratio={overall} label="Overall progress" />
        <dl className="mt-5 grid grid-cols-3 gap-4 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">Parts</dt>
            <dd className="text-lg font-semibold tabular-nums">{parts.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Chapters</dt>
            <dd className="text-lg font-semibold tabular-nums">{chapters.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Completed</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {chapters.filter((c) => chapterCompletion(progressById[c.id]) === 1).length}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Continue learning</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border border-border p-4">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="size-3.5" strokeWidth={1.75} />
              Reading progress
            </p>
            <p className="mt-2 truncate text-sm font-medium">
              {continueReading.number}. {continueReading.title}
            </p>
            <div className="mt-3">
              <ProgressBar
                ratio={readingRatioOf(progressById[continueReading.id])}
                label="Reading"
              />
            </div>
            <p className="mt-2 text-xs tabular-nums text-muted-foreground">
              Resumes on page {lastPage}
            </p>
            <Link
              to="/reader/$chapterId"
              params={{ chapterId: continueReading.id }}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Continue reading
            </Link>
          </article>

          <article className="rounded-lg border border-border p-4">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Headphones className="size-3.5" strokeWidth={1.75} />
              Audio progress
            </p>
            {continueListening ? (
              <>
                <p className="mt-2 truncate text-sm font-medium">
                  {continueListening.number}. {continueListening.title}
                </p>
                <div className="mt-3">
                  <ProgressBar
                    ratio={audioRatioOf(progressById[continueListening.id])}
                    label="Audio"
                  />
                </div>
                <Link
                  to="/audio"
                  search={{ chapter: continueListening.id }}
                  className="mt-4 inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
                >
                  Continue listening
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Audio unavailable</p>
            )}
          </article>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Study today</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {studyToday.length} chapters queued{todayMinutes > 0 ? ` · about ${todayMinutes} min` : ""}
        </p>
        <ul className="mt-3 space-y-2">
          {studyToday.map((chapter) => (
            <li key={chapter.id}>
              <Link
                to="/chapter/$chapterId"
                params={{ chapterId: chapter.id }}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {chapter.number}. {chapter.title}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" strokeWidth={1.75} />
                    {chapter.minutes ? `${chapter.minutes} min · ` : ""}
                    {toPercent(chapterCompletion(progressById[chapter.id]))}%
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={recents.length === 0 ? "hidden" : "mt-8"}>
        <h2 className="text-sm font-semibold tracking-tight">Recent chapters</h2>
        <ul className="mt-3 space-y-2">
          {recents.map((chapter) => (
            <li key={chapter.id}>
              <Link
                to="/chapter/$chapterId"
                params={{ chapterId: chapter.id }}
                className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-accent"
              >
                <p className="truncate text-sm">
                  {chapter.number}. {chapter.title}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {new Date(progressById[chapter.id]!.lastOpened!).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="text-sm font-semibold tracking-tight">Book parts</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {parts.map((part) => (
            <li key={part.id} className="rounded-lg border border-border p-4">
              <Link to="/course" className="block">
                <p className="text-sm font-medium">
                  {part.number}. {part.title}
                </p>
                <div className="mt-3">
                  <ProgressBar
                    ratio={partCompletion(part, chapters, progressById)}
                    label="Completion"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
