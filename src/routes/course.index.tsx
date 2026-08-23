import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chapters, chaptersInPart, course, parts, progressById } from "@/features/course/data";
import { partCompletion } from "@/features/progress/weights";

export const Route = createFileRoute("/course/")({
  head: () => ({
    meta: [
      { title: "Course Outline — ENCOR Study" },
      {
        name: "description",
        content: "Browse all six CCNP ENCOR 350-401 exam domains and their chapters in one outline.",
      },
      { property: "og:title", content: "Course Outline — ENCOR Study" },
      {
        property: "og:description",
        content: "Browse all six CCNP ENCOR 350-401 exam domains and their chapters.",
      },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  return (
    <div>
      <PageHeader
        eyebrow={course.code}
        title="Course outline"
        description="Six exam domains covering the enterprise core blueprint."
      />
      <ul className="space-y-3">
        {parts.map((part) => (
          <li key={part.id} className="rounded-lg border border-border p-4">
            <Link
              to="/course/$partId"
              params={{ partId: part.id }}
              className="flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-sm font-medium">
                  Part {part.number} · {part.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{part.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {chaptersInPart(part.id).length} chapters · {part.examWeight}% of exam
                </p>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            </Link>
            <div className="mt-3">
              <ProgressBar ratio={partCompletion(part, chapters, progressById)} label="Completion" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
