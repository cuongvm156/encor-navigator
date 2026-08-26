import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import {
  bookPartOfChapter,
  chaptersInDomain,
  domainChapterIds,
  getExamDomain,
} from "@/features/course/examDomains";
import type { Chapter, ChapterProgress } from "@/features/course/types";
import { useLiveProgress } from "@/features/progress/useLiveProgress";
import { domainCompletion, sectionCompletion } from "@/features/progress/examProgress";
import {
  audioRatioOf,
  chapterCompletion,
  readingRatioOf,
  statusOf,
  toPercent,
} from "@/features/progress/weights";

export const Route = createFileRoute("/course/$domainId")({
  loader: ({ params }) => {
    const domain = getExamDomain(params.domainId);
    if (!domain) throw notFound();
    return { domain };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Domain not found — ENCOR Study" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { domain } = loaderData;
    const title = `Domain ${domain.number}: ${domain.title} — ENCOR Study`;
    const description = `ENCOR 350-401 v1.2 exam domain ${domain.number} ${domain.title} (${domain.weight}% of the exam) and its Official Cert Guide chapters.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: DomainPage,
  errorComponent: () => (
    <div>
      <p className="text-sm">This domain could not be loaded.</p>
      <Link to="/course" className="mt-3 inline-block text-xs underline underline-offset-2">
        ← Back to study domains
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div>
      <PageHeader title="Domain not found" description="No such ENCOR v1.2 exam domain." />
      <Link to="/course" className="text-xs underline underline-offset-2">
        ← Back to study domains
      </Link>
    </div>
  ),
});

function ChapterRow({ chapter, progress }: { chapter: Chapter; progress?: ChapterProgress }) {
  const part = bookPartOfChapter(chapter);
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
        {part ? (
          <p className="mt-1 text-xs text-muted-foreground">
            OCG reference · Part {part.number}: {part.title}
          </p>
        ) : null}
      </Link>
    </li>
  );
}

function DomainPage() {
  const { domain } = Route.useLoaderData();
  const { progressById } = useLiveProgress();
  const chapters = chaptersInDomain(domain.id);
  const count = domainChapterIds(domain).length;

  return (
    <div>
      <Link to="/course" className="text-xs text-muted-foreground hover:text-foreground">
        ← ENCOR v1.2 study domains
      </Link>
      <div className="mt-3">
        <PageHeader
          eyebrow={`Domain ${domain.number} · ${domain.weight}% of exam · ${count} ${
            count === 1 ? "chapter" : "chapters"
          }`}
          title={domain.title}
        />
      </div>

      <section className="rounded-lg border border-border p-5">
        <ProgressBar ratio={domainCompletion(domain, progressById)} label="Domain completion" />
      </section>

      <div className="mt-4 space-y-3">
        {domain.sections ? (
          domain.sections.map((section) => (
            <section key={section.id} className="rounded-lg border border-border">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {section.label} {section.title}
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {toPercent(sectionCompletion(section, progressById))}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{section.focus}</p>
                <div className="mt-3 max-w-sm">
                  <ProgressBar
                    ratio={sectionCompletion(section, progressById)}
                    label="Section completion"
                  />
                </div>
              </div>
              <ul className="border-t border-border">
                {section.chapterIds.map((chapterId) => {
                  const chapter = chapters.find((c) => c.id === chapterId);
                  if (!chapter) return null;
                  return (
                    <ChapterRow
                      key={chapter.id}
                      chapter={chapter}
                      {...(progressById[chapter.id] ? { progress: progressById[chapter.id] } : {})}
                    />
                  );
                })}
              </ul>
            </section>
          ))
        ) : (
          <ul className="rounded-lg border border-border">
            {chapters.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                {...(progressById[chapter.id] ? { progress: progressById[chapter.id] } : {})}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
