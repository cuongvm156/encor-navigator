import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { PROGRESS_WEIGHTS, toPercent } from "@/features/progress/weights";
import { chapters, course, parts, resources } from "@/features/course/data";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ENCOR Study" },
      {
        name: "description",
        content: "Study preferences and app details for the ENCOR Study companion.",
      },
      { property: "og:title", content: "Settings — ENCOR Study" },
      { property: "og:description", content: "Study preferences and app details for ENCOR Study." },
    ],
  }),
  component: SettingsPage,
});

const rows = [
  { label: "Course", value: `${course.vendor} ${course.title} ${course.code}` },
  { label: "Parts", value: `${parts.length}` },
  { label: "Chapters", value: `${chapters.length}` },
  { label: "Resources", value: `${resources.length}` },
  { label: "Reading weight", value: `${toPercent(PROGRESS_WEIGHTS.reading)}%` },
  { label: "Resource weight", value: `${toPercent(PROGRESS_WEIGHTS.resources)}%` },
];

function SettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Read-only in this milestone — data is local demo content."
      />
      <dl className="divide-y divide-border rounded-lg border border-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-xs text-muted-foreground">
        ENCOR Study · installable to your home screen from your browser's share menu.
      </p>
    </div>
  );
}
