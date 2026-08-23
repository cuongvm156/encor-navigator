import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { PROGRESS_WEIGHTS, toPercent } from "@/features/progress/weights";
import { chapters, course, parts } from "@/features/course/data";

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

interface SettingRow {
  label: string;
  value: string;
  hint?: string;
}

const audioRows: SettingRow[] = [
  { label: "Default playback speed", value: "1×" },
  { label: "Seek interval", value: "15 s" },
  { label: "Auto-resume last position", value: "On" },
  { label: "Default repeat mode", value: "Off" },
];

const pdfRows: SettingRow[] = [{ label: "Remember last page", value: "On" }];

const dataRows: SettingRow[] = [
  { label: "Export study data", value: "Export" },
  { label: "Import study data", value: "Import" },
  { label: "Reset all progress", value: "Reset" },
];

const aboutRows: SettingRow[] = [
  { label: "App version", value: "1.0.0 (MVP)" },
  { label: "Course", value: `${course.vendor} ${course.title} ${course.code}` },
  { label: "Content", value: `${parts.length} parts · ${chapters.length} chapters` },
  {
    label: "Progress weighting",
    value: `${toPercent(PROGRESS_WEIGHTS.reading)}% reading · ${toPercent(PROGRESS_WEIGHTS.audio)}% audio`,
  },
];

function SettingsSection({ title, rows }: { title: string; rows: SettingRow[] }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
        {rows.map((row) => (
          <div key={row.label} className="flex min-h-12 items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="shrink-0 font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Placeholder controls in this milestone — values are local demo settings."
      />
      <SettingsSection title="Audio" rows={audioRows} />
      <SettingsSection title="PDF" rows={pdfRows} />
      <SettingsSection title="Data" rows={dataRows} />
      <SettingsSection title="About" rows={aboutRows} />
      <p className="mt-6 text-xs text-muted-foreground">
        ENCOR Study · installable to your home screen from your browser's share menu.
      </p>
    </div>
  );
}
