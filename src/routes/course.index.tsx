import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { course } from "@/features/course/data";
import {
  REFERENCE_NOTE,
  activeExamChapters,
  chaptersInDomain,
  domainChapterIds,
  examDomains,
} from "@/features/course/examDomains";
import type { Chapter } from "@/features/course/types";
import { useLiveProgress } from "@/features/progress/useLiveProgress";
import { domainCompletion, sectionCompletion } from "@/features/progress/examProgress";
import {
  audioRatioOf,
  chapterCompletion,
  readingRatioOf,
  statusOf,
  toPercent,
} from "@/features/progress/weights";
import type { ChapterProgress } from "@/features/course/types";

export const Route = createFileRoute("/course/")({
  head: () => ({
    meta: [
      { title: "ENCOR v1.2 Study Domains — ENCOR Study" },
      {
        name: "description",
        content:
          "Study the six weighted Cisco ENCOR 350-401 v1.2 exam domains and their 24 active Official Cert Guide chapters.",
      },
      { property: "og:title", content: "ENCOR v1.2 Study Domains — ENCOR Study" },
      {
        property: "og:description",
        content: "Six weighted ENCOR v1.2 exam domains covering 24 active chapters.",
      },
    ],
  }),
  component: CoursePage,
});

function ChapterRow({
  chapter,
  progress,
}: {
  chapter: Chapter;
  progress?: ChapterProgress;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
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
          <span className="tabular-nums">Reading {toPercent(readingRatioOf(progress))}%</span>
          <span className="tabular-nums">Media {toPercent(audioRatioOf(progress))}%</span>
          <span>{statusOf(progress)}</span>
        </p>
      </Link>
    </li>
  );
}

function CoursePage() {
  const { progressById } = useLiveProgress();
  const [openDomains, setOpenDomains] = useState<string[]>(() =>
    examDomains[0] ? [examDomains[0].id] : [],
  );

  const toggle = (domainId: string) =>
    setOpenDomains((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId],
    );

  return (
    <div>
      <PageHeader
        eyebrow={course.code}
        title="ENCOR v1.2 study domains"
        description={`${examDomains.length} weighted exam domains covering ${activeExamChapters.length} active Official Cert Guide chapters.`}
      />

      <p className="mb-4 rounded-lg border border-border px-4 py-3 text-xs text-muted-foreground">
        {REFERENCE_NOTE}
      </p>

      <ul className="space-y-3">
        {examDomains.map((domain) => {
          const open = openDomains.includes(domain.id);
          const count = domainChapterIds(domain).length;
          return (
            <li key={domain.id} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => toggle(domain.id)}
                aria-expanded={open}
                className="flex w-full items-start justify-between gap-4 p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {domain.number}. {domain.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {domain.weight}% of exam · {count} {count === 1 ? "chapter" : "chapters"}
                  </p>
                  <div className="mt-3 max-w-sm">
                    <ProgressBar
                      ratio={domainCompletion(domain, progressById)}
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
                <div className="border-t border-border">
                  {domain.sections ? (
                    domain.sections.map((section) => (
                      <div key={section.id} className="border-b border-border last:border-b-0">
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">
                              {section.label} {section.title}
                            </p>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {toPercent(sectionCompletion(section, progressById))}%
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{section.focus}</p>
                        </div>
                        <ul className="border-t border-border">
                          {section.chapterIds.map((chapterId) => {
                            const chapter = chaptersInDomain(domain.id).find(
                              (c) => c.id === chapterId,
                            );
                            if (!chapter) return null;
                            return (
                              <ChapterRow
                                key={chapter.id}
                                chapter={chapter}
                                {...(progressById[chapter.id]
                                  ? { progress: progressById[chapter.id] }
                                  : {})}
                              />
                            );
                          })}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <ul>
                      {chaptersInDomain(domain.id).map((chapter) => (
                        <ChapterRow
                          key={chapter.id}
                          chapter={chapter}
                          {...(progressById[chapter.id]
                            ? { progress: progressById[chapter.id] }
                            : {})}
                        />
                      ))}
                    </ul>
                  )}
                  <div className="border-t border-border px-4 py-3">
                    <Link
                      to="/course/$domainId"
                      params={{ domainId: domain.id }}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Open domain {domain.number}
                    </Link>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
