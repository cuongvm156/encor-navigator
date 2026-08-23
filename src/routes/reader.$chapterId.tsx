import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Bookmark, ChevronLeft, ChevronRight, Minus, Plus, StickyNote } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { getChapter } from "@/features/course/data";
import { PdfPageView } from "@/features/reading/PdfPageView";
import { useReaderState } from "@/features/reading/useReaderState";
import { toPercent } from "@/features/progress/weights";
import { NoteComposer } from "@/features/annotations/NoteComposer";
import { usePageAnnotations } from "@/features/annotations/useAnnotations";
import {
  bookmarksRepository,
  readerNotesRepository,
} from "@/repositories/readerAnnotationsRepository";


export const Route = createFileRoute("/reader/$chapterId")({
  validateSearch: (search: Record<string, unknown>): { page?: number } => {
    const raw = Number(search["page"]);
    return Number.isFinite(raw) && raw >= 1 ? { page: Math.floor(raw) } : {};
  },
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
        {
          name: "description",
          content: `Read chapter ${loaderData.chapter.number}: ${loaderData.chapter.title}.`,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: `Read chapter ${loaderData.chapter.number}: ${loaderData.chapter.title}.`,
        },
      ],
    };
  },
  component: ReaderPage,
});

const controlClass =
  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50";

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

function ReaderPage() {
  const { chapter } = Route.useLoaderData();
  const { page: requestedPage } = Route.useSearch();
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const reader = useReaderState(chapter.id, chapter.pdfResourceId, pages, requestedPage);
  const { currentPage: page, readingRatio: ratio, ready } = reader;
  const [jumpValue, setJumpValue] = useState(String(page));
  const [composerOpen, setComposerOpen] = useState(false);

  const annotationsEnabled = Boolean(chapter.pdfUrl && chapter.pdfResourceId);
  const { isBookmarked, noteCount } = usePageAnnotations(
    annotationsEnabled ? chapter.pdfResourceId : undefined,
    page,
  );

  const handleDocumentLoaded = useCallback((totalPages: number) => {
    setPages(totalPages);
  }, []);

  useEffect(() => {
    setJumpValue(String(page));
  }, [page]);

  const commitJump = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > pages) {
      setJumpValue(String(page));
      return;
    }
    reader.goToPage(parsed);
  };

  const toggleBookmark = async () => {
    if (!annotationsEnabled || !chapter.pdfResourceId) return;
    const added = await bookmarksRepository.toggle(chapter.id, chapter.pdfResourceId, page);
    toast.success(added ? `Bookmarked page ${page}` : `Bookmark removed from page ${page}`);
  };

  const saveNote = async (body: string) => {
    if (!annotationsEnabled || !chapter.pdfResourceId) return;
    await readerNotesRepository.create({
      chapterId: chapter.id,
      pdfResourceId: chapter.pdfResourceId,
      pageNumber: page,
      body,
    });
    toast.success(`Note saved on page ${page}`);
  };

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
        {annotationsEnabled ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`${controlClass} ${isBookmarked ? "bg-accent text-foreground" : ""}`}
              aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this page"}
              aria-pressed={isBookmarked}
              disabled={!ready}
              onClick={() => void toggleBookmark()}
            >
              <Bookmark
                className="size-4"
                strokeWidth={1.75}
                {...(isBookmarked ? { fill: "currentColor" } : {})}
              />
            </button>
            <button
              type="button"
              className={controlClass}
              aria-label="Add note"
              disabled={!ready}
              onClick={() => setComposerOpen(true)}
            >
              <StickyNote className="size-4" strokeWidth={1.75} />
            </button>
            <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {noteCount} {noteCount === 1 ? "note" : "notes"} on this page
            </span>
          </div>
        ) : null}
      </div>

      {annotationsEnabled ? (
        <NoteComposer
          open={composerOpen}
          onOpenChange={setComposerOpen}
          chapterTitle={`${chapter.number}. ${chapter.title}`}
          pageNumber={page}
          onSave={saveNote}
        />
      ) : null}


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
          {!chapter.pdfUrl
            ? "PDF unavailable for this chapter"
            : ready
              ? `Page ${page} of ${pages} · ${toPercent(ratio)}% read`
              : "Loading PDF…"}
        </p>
      </section>

      <PdfPageView
        pdfUrl={chapter.pdfUrl}
        page={page}
        zoom={zoom}
        onDocumentLoaded={handleDocumentLoaded}
      />

      {chapter.pdfUrl ? (
      <section className="sticky bottom-20 z-10 mt-4 rounded-lg border border-border bg-background/95 p-3 backdrop-blur md:bottom-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={controlClass}
              aria-label="Previous page"
              disabled={!ready || !reader.canGoPrevious}
              onClick={reader.previousPage}
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={controlClass}
              aria-label="Next page"
              disabled={!ready || !reader.canGoNext}
              onClick={reader.nextPage}
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Jump to
            <input
              type="number"
              min={1}
              max={pages}
              step={1}
              value={jumpValue}
              onChange={(event) => setJumpValue(event.target.value)}
              onBlur={(event) => commitJump(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitJump((event.target as HTMLInputElement).value);
              }}
              disabled={!ready}
              className="h-10 w-20 rounded-md border border-input bg-background px-2 text-sm tabular-nums text-foreground"
              aria-label="Jump to page"
            />
            <span className="tabular-nums">/ {pages}</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={controlClass}
              aria-label="Zoom out"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
            >
              <Minus className="size-4" strokeWidth={1.75} />
            </button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className={controlClass}
              aria-label="Zoom in"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
            >
              <Plus className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </section>
      ) : null}
    </div>
  );
}
