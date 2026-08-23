import { createFileRoute, Link } from "@tanstack/react-router";
import { Pause, Play, Rewind, FastForward } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chapters, getChapter, progressById } from "@/features/course/data";
import { audioRatioOf, toPercent } from "@/features/progress/weights";

export const Route = createFileRoute("/audio")({
  validateSearch: (search: Record<string, unknown>) => ({
    chapter: typeof search["chapter"] === "string" ? (search["chapter"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Audio Player — ENCOR Study" },
      {
        name: "description",
        content: "Listen to CCNP ENCOR 350-401 chapter audio and pick up where you left off.",
      },
      { property: "og:title", content: "Audio Player — ENCOR Study" },
      {
        property: "og:description",
        content: "Listen to CCNP ENCOR chapter audio and pick up where you left off.",
      },
    ],
  }),
  component: AudioPage,
});

function AudioPage() {
  const { chapter: chapterId } = Route.useSearch();
  const current =
    (chapterId ? getChapter(chapterId) : undefined) ??
    chapters.find((c) => {
      const r = audioRatioOf(progressById[c.id]);
      return r > 0 && r < 1;
    }) ??
    chapters[0];

  const ratio = audioRatioOf(progressById[current.id]);
  const elapsed = Math.round(current.minutes * ratio);

  return (
    <div>
      <PageHeader
        eyebrow="Audio"
        title="Audio player"
        description="Chapter audio for hands-free review."
      />

      <section className="rounded-lg border border-border p-5">
        <p className="text-xs text-muted-foreground">Now playing</p>
        <p className="mt-1 text-sm font-medium">
          {current.number}. {current.title}
        </p>
        <div className="mt-4">
          <ProgressBar ratio={ratio} label="Audio progress" />
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          {elapsed} / {current.minutes} min · {toPercent(ratio)}%
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md border border-input transition-colors hover:bg-accent"
            aria-label="Rewind 15 seconds"
          >
            <Rewind className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
            aria-label="Play"
          >
            <Play className="size-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md border border-input transition-colors hover:bg-accent"
            aria-label="Pause"
          >
            <Pause className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md border border-input transition-colors hover:bg-accent"
            aria-label="Forward 30 seconds"
          >
            <FastForward className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Chapter audio</h2>
        <ul className="mt-3 space-y-2">
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <Link
                to="/audio"
                search={{ chapter: chapter.id }}
                className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-accent"
              >
                <p className="truncate text-sm">
                  {chapter.number}. {chapter.title}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {toPercent(audioRatioOf(progressById[chapter.id]))}%
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
