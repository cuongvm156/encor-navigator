import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { getChapter, resources } from "@/features/course/data";
import type { ResourceKind } from "@/features/course/types";

const kinds: ResourceKind[] = ["reading", "video", "audio", "notes", "link"];

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Study Resources — ENCOR Study" },
      {
        name: "description",
        content: "All readings, notes, audio recaps, and reference links collected for CCNP ENCOR 350-401.",
      },
      { property: "og:title", content: "Study Resources — ENCOR Study" },
      {
        property: "og:description",
        content: "Readings, notes, audio recaps, and reference links for CCNP ENCOR 350-401.",
      },
    ],
  }),
  component: ResourcesPage,
});

function ResourcesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Study resources"
        description="Every resource attached to a chapter, grouped by type."
      />
      <div className="space-y-8">
        {kinds.map((kind) => {
          const group = resources.filter((r) => r.kind === kind);
          if (group.length === 0) return null;
          return (
            <section key={kind}>
              <h2 className="text-sm font-semibold capitalize tracking-tight">{kind}</h2>
              <ul className="mt-3 space-y-2">
                {group.map((resource) => {
                  const chapter = getChapter(resource.chapterId);
                  return (
                    <li key={resource.id}>
                      <Link
                        to="/chapter/$chapterId"
                        params={{ chapterId: resource.chapterId }}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">{resource.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {chapter ? `Ch ${chapter.number} · ${chapter.title}` : resource.source}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {resource.minutes} min
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
