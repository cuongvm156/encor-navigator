import { createFileRoute, Link } from "@tanstack/react-router";
import { Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chapters, course, getChapter, progressById } from "@/features/course/data";
import { audioPositionOf, chapterAudioSeconds, formatTime } from "@/features/course/derive";
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

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const REPEAT = ["Off", "Once", "Lesson"] as const;
const SLEEP = ["Off", "15 min", "30 min", "45 min", "60 min", "End of track"] as const;

const iconButton =
  "inline-flex size-11 items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent";

function OptionRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  format?: (option: T) => string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={String(option)}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              className={`min-h-9 rounded-md border px-3 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              {format ? format(option) : String(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AudioPage() {
  const { chapter: chapterId } = Route.useSearch();
  const current =
    (chapterId ? getChapter(chapterId) : undefined) ??
    chapters.find((c) => {
      const r = audioRatioOf(progressById[c.id]);
      return r > 0 && r < 1;
    }) ??
    chapters[0]!;

  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [repeat, setRepeat] = useState<(typeof REPEAT)[number]>("Off");
  const [sleep, setSleep] = useState<(typeof SLEEP)[number]>("Off");
  const [playing, setPlaying] = useState(false);

  const progress = progressById[current.id];
  const ratio = audioRatioOf(progress);
  const duration = chapterAudioSeconds(current);
  const position = audioPositionOf(current, progress);

  return (
    <div>
      <PageHeader
        eyebrow="Audio"
        title="Audio player"
        description="Chapter audio for hands-free review."
      />

      <section className="rounded-lg border border-border p-5">
        <p className="text-xs text-muted-foreground">
          {course.vendor} {course.code} · Chapter {current.number}
        </p>
        <p className="mt-1 text-base font-medium leading-snug">{current.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Chapter audio narration</p>

        <div className="mt-5">
          <ProgressBar ratio={ratio} label="Audio progress" />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(position)}</span>
          <span>{toPercent(ratio)}%</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className={iconButton} aria-label="Previous chapter">
            <SkipBack className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={iconButton} aria-label="Back 15 seconds">
            <RotateCcw className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="size-6" strokeWidth={1.75} />
            ) : (
              <Play className="size-6" strokeWidth={1.75} />
            )}
          </button>
          <button type="button" className={iconButton} aria-label="Forward 15 seconds">
            <RotateCw className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={iconButton} aria-label="Next chapter">
            <SkipForward className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-6 space-y-4 border-t border-border pt-5">
          <OptionRow
            label="Playback speed"
            options={SPEEDS}
            value={speed}
            onChange={setSpeed}
            format={(s) => `${s}×`}
          />
          <OptionRow label="Repeat" options={REPEAT} value={repeat} onChange={setRepeat} />
          <OptionRow label="Sleep timer" options={SLEEP} value={sleep} onChange={setSleep} />
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
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {chapter.number}. {chapter.title}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {formatTime(chapterAudioSeconds(chapter))}
                  </p>
                </div>
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
