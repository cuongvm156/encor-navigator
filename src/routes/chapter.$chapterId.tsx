import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { getChapter, getPart, progressById, resourcesForChapter } from "@/features/course/data";
import { PROGRESS_WEIGHTS, chapterCompletion, toPercent } from "@/features/progress/weights";

export const Route = createFileRoute("/chapter/$chapterId")({
  loader: ({ params }) => {
    const chapter = getChapter(params.chapterId);
    if (!chapter) throw notFound();
    return { chapter };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Chapter not found — ENCOR Study" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.chapter.title} — ENCOR Study`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.chapter.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.chapter.summary },
      ],
    };
  },
  component: ChapterPage,
});

function ChapterPage() {
  const { chapter } = Route.useLoaderData();
  const part = getPart(chapter.partId);
  const progress = progressById[chapter.id];
  const chapterResources = resourcesForChapter(chapter.id);

  return (
    <div>
      {part ? (
        <Link
          to="/course/$partId"
          params={{ partId: part.id }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← {part.title}
        </Link>
      ) : null}
      <div className="mt-3">
        <PageHeader
          eyebrow={`Chapter ${chapter.number} · ${chapter.minutes} min`}
          title={chapter.title}
          description={chapter.summary}
        />
      </div>

      <section className="rounded-lg border border-border p-5">
        <ProgressBar ratio={chapterCompletion(progress)} label="Chapter completion" />
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div>
            Reading ({toPercent(PROGRESS_WEIGHTS.reading)}% weight) —{" "}
            <span className="text-foreground tabular-nums">{toPercent(progress?.readRatio ?? 0)}%</span>
          </div>
          <div>
            Resources ({toPercent(PROGRESS_WEIGHTS.resources)}% weight) —{" "}
            <span className="text-foreground tabular-nums">
              {toPercent(progress?.resourceRatio ?? 0)}%
            </span>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Objectives</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {chapter.objectives.map((objective) => (
            <li key={objective} className="rounded-md border border-border px-3 py-2">
              {objective}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Resources</h2>
        <ul className="mt-3 space-y-2">
          {chapterResources.map((resource) => (
            <li
              key={resource.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{resource.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {resource.kind} · {resource.source}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {resource.minutes} min
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
