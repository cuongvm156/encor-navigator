import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileText,
  Minus,
  Plus,
  StickyNote,
} from "lucide-react";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { getChapter, progressById } from "@/features/course/data";
import { chapterPages, lastPageOf } from "@/features/course/derive";
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

const controlClass =
  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent";

function ReaderPage() {
  const { chapter } = Route.useLoaderData();
  const progress = progressById[chapter.id];
  const ratio = readingRatioOf(progress);
  const pages = chapterPages(chapter);
  const page = lastPageOf(chapter, progress);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/chapter/$chapterId"
          params={{ chapterId: chapter.id }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          Chapter {chapter.number}
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" className={controlClass} aria-label="Bookmark this page">
            <Bookmark className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={controlClass} aria-label="Add note">
            <StickyNote className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <header className="mt-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Reader
        </p>
        <h1 className="mt-1 truncate text-xl font-semibold tracking-tight md:text-2xl">
          {chapter.number}. {chapter.title}
        </h1>
      </header>

      <section className="mt-4 rounded-lg border border-border p-4">
        <ProgressBar ratio={ratio} label="Reading progress" />
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          Page {page} of {pages} · {toPercent(ratio)}% read
        </p>
      </section>

      <section className="mt-4 flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center md:min-h-[38rem]">
        <FileText className="size-6 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium">Document viewer</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Page {page} placeholder. The chapter document renders in this pane.
        </p>
      </section>

      <section className="sticky bottom-20 z-10 mt-4 rounded-lg border border-border bg-background/95 p-3 backdrop-blur md:bottom-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" className={controlClass} aria-label="Previous page">
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </button>
            <button type="button" className={controlClass} aria-label="Next page">
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Jump to
            <input
              type="number"
              min={1}
              max={pages}
              defaultValue={page}
              className="h-10 w-20 rounded-md border border-input bg-background px-2 text-sm tabular-nums text-foreground"
              aria-label="Jump to page"
            />
            <span className="tabular-nums">/ {pages}</span>
          </label>

          <div className="flex items-center gap-2">
            <button type="button" className={controlClass} aria-label="Zoom out">
              <Minus className="size-4" strokeWidth={1.75} />
            </button>
            <span className="text-xs tabular-nums text-muted-foreground">100%</span>
            <button type="button" className={controlClass} aria-label="Zoom in">
              <Plus className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
