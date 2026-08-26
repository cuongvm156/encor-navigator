import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Clock, Headphones } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { course, resources } from "@/features/course/data";
import {
  activeExamChapters,
  chaptersInDomain,
  examDomains,
  isInActiveExamScope,
} from "@/features/course/examDomains";
import { hasAudio } from "@/features/audio/sources";
import { pickContinueReading, useLiveProgress } from "@/features/progress/useLiveProgress";
import { domainCompletion, sectionCompletion } from "@/features/progress/examProgress";
import { weightedExamCompletion } from "@/features/progress/examProgress";
import {
  audioRatioOf,
  chapterCompletion,
  readingRatioOf,
  toPercent,
} from "@/features/progress/weights";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ENCOR Study — CCNP 350-401 v1.2 Domain Dashboard" },
      {
        name: "description",
        content:
          "Track weighted CCNP ENCOR 350-401 v1.2 exam-domain progress, continue where you left off, and plan today's study session.",
      },
      { property: "og:title", content: "ENCOR Study — CCNP 350-401 v1.2 Domain Dashboard" },
      {
        property: "og:description",
        content: "Weighted exam-domain progress, continue reading, and continue listening.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { progressById, readingStates } = useLiveProgress();
  const overall = weightedExamCompletion(progressById);

  const recents = activeExamChapters
    .filter((c) => progressById[c.id]?.lastOpened)
    .sort((a, b) =>
      (progressById[b.id]?.lastOpened ?? "").localeCompare(progressById[a.id]?.lastOpened ?? ""),
    )
    .slice(0, 4);

  // Most recently updated readable chapter from persisted reading progress.
  const picked = pickContinueReading(readingStates);
  const continueReading = isInActiveExamScope(picked.chapter.id)
    ? picked.chapter
    : (activeExamChapters.find((c) => c.pdfUrl && c.pdfResourceId) ?? activeExamChapters[0]!);
  const lastPage = continueReading.id === picked.chapter.id ? picked.lastPage : 1;

  const audioChapters = activeExamChapters.filter((c) => hasAudio(c, resources));
  const continueListening =
    audioChapters.find((c) => {
      const r = audioRatioOf(progressById[c.id]);
      return r > 0 && r < 1;
    }) ?? audioChapters[0];

  const studyToday = activeExamChapters
    .filter((c) => chapterCompletion(progressById[c.id]) < 1)
    .slice(0, 3);
  const todayMinutes = studyToday.reduce((sum, c) => sum + (c.minutes ?? 0), 0);

  const completedUnits = activeExamChapters.filter(
    (c) => chapterCompletion(progressById[c.id]) === 1,
  ).length;

  return (
    <div>
      <PageHeader
        eyebrow={`${course.vendor} · ${course.code}`}
        title="ENCOR Study"
        description={course.description}
      />

      <section className="rounded-lg border border-border p-5">
        <ProgressBar ratio={overall} label="Overall exam progress (domain-weighted)" />
        <dl className="mt-5 grid grid-cols-3 gap-4 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">Domains</dt>
            <dd className="text-lg font-semibold tabular-nums">{examDomains.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Learning Units</dt>
            <dd className="text-lg font-semibold tabular-nums">{activeExamChapters.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Completed</dt>
            <dd className="text-lg font-semibold tabular-nums">{completedUnits}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Exam domains</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {examDomains.map((domain) => {
            const units = chaptersInDomain(domain.id).length;
            return (
              <li key={domain.id} className="rounded-lg border border-border p-4">
                <Link
                  to="/course/$domainId"
                  params={{ domainId: domain.id }}
                  className="block transition-colors hover:opacity-90"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {domain.number}. {domain.title}
                    </p>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {domain.weight}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {units} Learning Unit{units === 1 ? "" : "s"}
                  </p>
                  <div className="mt-3">
                    <ProgressBar
                      ratio={domainCompletion(domain, progressById)}
                      label="Domain progress"
                    />
                  </div>
                  {domain.sections ? (
                    <div className="mt-4 space-y-3 border-t border-border pt-3">
                      {domain.sections.map((section) => (
                        <ProgressBar
                          key={section.id}
                          ratio={sectionCompletion(section, progressById)}
                          label={`${section.label} ${section.title}`}
                        />
                      ))}
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
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
          {studyToday.length} Learning Units queued
          {todayMinutes > 0 ? ` · about ${todayMinutes} min` : ""}
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
        <h2 className="text-sm font-semibold tracking-tight">Recent Learning Units</h2>
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
    </div>
  );
}
