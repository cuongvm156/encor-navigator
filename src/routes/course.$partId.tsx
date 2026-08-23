import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chaptersInPart, getPart, progressById } from "@/features/course/data";
import { chapterCompletion } from "@/features/progress/weights";

export const Route = createFileRoute("/course/$partId")({
  loader: ({ params }) => {
    const part = getPart(params.partId);
    if (!part) throw notFound();
    return { part };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Part not found — ENCOR Study" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.part.title} — ENCOR Study`;
    const description =
      loaderData.part.description ??
      `Chapters in Part ${loaderData.part.number}: ${loaderData.part.title} of the CCNP ENCOR 350-401 Official Cert Guide.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: PartPage,
});

function PartPage() {
  const { part } = Route.useLoaderData();
  const list = chaptersInPart(part.id);

  return (
    <div>
      <Link to="/course" className="text-xs text-muted-foreground hover:text-foreground">
        ← Course outline
      </Link>
      <div className="mt-3">
        <PageHeader
          eyebrow={`Part ${part.number} · ${list.length} chapters`}
          title={part.title}
          {...(part.description ? { description: part.description } : {})}
        />
      </div>
      <ul className="space-y-2">
        {list.map((chapter) => (
          <li key={chapter.id}>
            <Link
              to="/chapter/$chapterId"
              params={{ chapterId: chapter.id }}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {chapter.number}. {chapter.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{chapter.summary}</p>
                <div className="mt-3 max-w-xs">
                  <ProgressBar ratio={chapterCompletion(progressById[chapter.id])} label={`${chapter.minutes} min`} />
                </div>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
