import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chapters, chaptersInPart, parts, progressById } from "@/features/course/data";
import {
  PROGRESS_WEIGHTS,
  audioRatioOf,
  averageCompletion,
  averageOf,
  chapterCompletion,
  partCompletion,
  readingRatioOf,
  toPercent,
} from "@/features/progress/weights";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress — ENCOR Study" },
      {
        name: "description",
        content: "See weighted completion for every CCNP ENCOR book part and chapter at a glance.",
      },
      { property: "og:title", content: "Progress — ENCOR Study" },
      {
        property: "og:description",
        content: "Weighted completion for every CCNP ENCOR book part and chapter.",
      },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tracking"
        title="Progress"
        description={`Completion is weighted ${toPercent(PROGRESS_WEIGHTS.reading)}% reading and ${toPercent(
          PROGRESS_WEIGHTS.audio,
        )}% audio.`}
      />

      <section className="space-y-4 rounded-lg border border-border p-5">
        <ProgressBar ratio={averageCompletion(chapters, progressById)} label="Overall" />
        <ProgressBar
          ratio={averageOf(chapters, progressById, readingRatioOf)}
          label="Reading"
        />
        <ProgressBar ratio={averageOf(chapters, progressById, audioRatioOf)} label="Listening" />
      </section>

      <div className="mt-8 space-y-6">
        {parts.map((part) => (
          <section key={part.id}>
            <h2 className="text-sm font-semibold tracking-tight">
              Part {part.number} · {part.title}
            </h2>
            <div className="mt-3">
              <ProgressBar ratio={partCompletion(part, chapters, progressById)} label="Part completion" />
            </div>
            <ul className="mt-4 space-y-3">
              {chaptersInPart(part.id).map((chapter) => (
                <li key={chapter.id} className="rounded-lg border border-border px-4 py-3">
                  <ProgressBar
                    ratio={chapterCompletion(progressById[chapter.id])}
                    label={`${chapter.number}. ${chapter.title}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
