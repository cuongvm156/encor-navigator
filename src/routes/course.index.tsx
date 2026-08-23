import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chapters, chaptersInPart, course, parts, progressById } from "@/features/course/data";
import {
  audioRatioOf,
  chapterCompletion,
  partCompletion,
  readingRatioOf,
  statusOf,
  toPercent,
} from "@/features/progress/weights";

export const Route = createFileRoute("/course/")({
  head: () => ({
    meta: [
      { title: "Course Outline — ENCOR Study" },
      {
        name: "description",
        content:
          "Browse the nine book parts and 29 technical chapters of the CCNP ENCOR 350-401 Official Cert Guide.",
      },
      { property: "og:title", content: "Course Outline — ENCOR Study" },
      {
        property: "og:description",
        content: "Nine book parts and 29 technical chapters of the CCNP ENCOR 350-401 course.",
      },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  const [openParts, setOpenParts] = useState<string[]>(() => (parts[0] ? [parts[0].id] : []));

  const toggle = (partId: string) =>
    setOpenParts((prev) =>
      prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId],
    );

  return (
    <div>
      <PageHeader
        eyebrow={course.code}
        title="Course outline"
        description={`${parts.length} book parts and ${chapters.length} technical chapters from the Official Cert Guide.`}
      />
      <ul className="space-y-3">
        {parts.map((part) => {
          const open = openParts.includes(part.id);
          const partChapters = chaptersInPart(part.id);
          return (
            <li key={part.id} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => toggle(part.id)}
                aria-expanded={open}
                className="flex w-full items-start justify-between gap-4 p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Part {part.number} · {part.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {partChapters.length} {partChapters.length === 1 ? "chapter" : "chapters"}
                    {part.examWeight ? ` · ${part.examWeight}% of exam` : ""}
                  </p>
                  <div className="mt-3 max-w-sm">
                    <ProgressBar
                      ratio={partCompletion(part, chapters, progressById)}
                      label="Completion"
                    />
                  </div>
                </div>
                <ChevronDown
                  className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.75}
                />
              </button>

              {open ? (
                <ul className="border-t border-border">
                  {partChapters.map((chapter) => {
                    const progress = progressById[chapter.id];
                    return (
                      <li key={chapter.id} className="border-b border-border last:border-b-0">
                        <Link
                          to="/chapter/$chapterId"
                          params={{ chapterId: chapter.id }}
                          className="block px-4 py-3 transition-colors hover:bg-accent"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm">
                              {chapter.number}. {chapter.title}
                            </p>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {toPercent(chapterCompletion(progress))}%
                            </span>
                          </div>
                          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="tabular-nums">
                              Reading {toPercent(readingRatioOf(progress))}%
                            </span>
                            <span className="tabular-nums">
                              Audio {toPercent(audioRatioOf(progress))}%
                            </span>
                            <span>{statusOf(progress)}</span>
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
