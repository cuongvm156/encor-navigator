import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chapters, course, parts, progressById } from "@/features/course/data";
import { averageCompletion, chapterCompletion, partCompletion, toPercent } from "@/features/progress/weights";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ENCOR Study — CCNP 350-401 Study Dashboard" },
      {
        name: "description",
        content:
          "Track your CCNP ENCOR 350-401 study progress across all six exam domains with a mobile-first study dashboard.",
      },
      { property: "og:title", content: "ENCOR Study — CCNP 350-401 Study Dashboard" },
      {
        property: "og:description",
        content: "Track your CCNP ENCOR 350-401 study progress across all six exam domains.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const overall = averageCompletion(chapters, progressById);
  const inProgress = chapters
    .filter((c) => {
      const ratio = chapterCompletion(progressById[c.id]);
      return ratio > 0 && ratio < 1;
    })
    .slice(0, 3);

  return (
    <div>
      <PageHeader
        eyebrow={`${course.vendor} · ${course.code}`}
        title="ENCOR Study"
        description={course.description}
      />

      <section className="rounded-lg border border-border p-5">
        <ProgressBar ratio={overall} label="Overall course completion" />
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
        <h2 className="text-sm font-semibold tracking-tight">Continue studying</h2>
        <ul className="mt-3 space-y-2">
          {inProgress.map((chapter) => (
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
                    {chapter.minutes} min · {toPercent(chapterCompletion(progressById[chapter.id]))}%
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Exam domains</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {parts.map((part) => (
            <li key={part.id} className="rounded-lg border border-border p-4">
              <Link to="/course/$partId" params={{ partId: part.id }} className="block">
                <p className="text-sm font-medium">
                  {part.number}. {part.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{part.examWeight}% of exam</p>
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
