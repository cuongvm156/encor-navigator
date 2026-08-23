import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { getChapter, progressById } from "@/features/course/data";
import { readingRatioOf, toPercent } from "@/features/progress/weights";

export const Route = createFileRoute("/reader/$chapterId")({
  loader: ({ params }) => {
    const chapter = getChapter(params.chapterId);
    if (!chapter) throw notFound();
    return { chapter };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Reader — ENCOR Study" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `Reading: ${loaderData.chapter.title} — ENCOR Study`;
    return {
      meta: [
        { title },
        { name: "description", content: `Read chapter ${loaderData.chapter.number}: ${loaderData.chapter.summary}` },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.chapter.summary },
      ],
    };
  },
  component: ReaderPage,
});

function ReaderPage() {
  const { chapter } = Route.useLoaderData();
  const ratio = readingRatioOf(progressById[chapter.id]);

  return (
    <div>
      <Link
        to="/chapter/$chapterId"
        params={{ chapterId: chapter.id }}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← Chapter {chapter.number}
      </Link>
      <div className="mt-3">
        <PageHeader
          eyebrow="Reader"
          title={chapter.title}
          description="Chapter reading view. The PDF document renders here."
        />
      </div>

      <section className="rounded-lg border border-border p-5">
        <ProgressBar ratio={ratio} label="Reading progress" />
        <p className="mt-3 text-xs text-muted-foreground tabular-nums">
          {toPercent(ratio)}% read · {chapter.minutes} min chapter
        </p>
      </section>

      <section className="mt-6 flex min-h-[22rem] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
        <FileText className="size-6 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium">Document viewer</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          The chapter PDF will be displayed in this pane, with page navigation and highlighting.
        </p>
      </section>
    </div>
  );
}
