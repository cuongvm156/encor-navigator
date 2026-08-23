import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { PROGRESS_WEIGHTS, toPercent } from "@/features/progress/weights";
import { chapters, course, parts } from "@/features/course/data";
import {
  audioStatus,
  getAvailableAudioCount,
  getAvailablePdfCount,
  getTestingResourceCount,
  pdfStatus,
  type ResourceStatus,
} from "@/data/resourceManifest";

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

const dataRows: SettingRow[] = [{ label: "Reset all progress", value: "Reset" }];


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

const statusLabel = (status: ResourceStatus) =>
  status === "available"
    ? "Available"
    : status === "testing"
      ? "Test"
      : status === "archived"
        ? "Archived"
        : "Unavailable";

function ResourceStatusSection() {
  const pdfActive = getAvailablePdfCount();
  const audioActive = getAvailableAudioCount();
  const rows: SettingRow[] = [
    { label: "Course chapters", value: String(chapters.length) },
    { label: "PDFs available / testing", value: String(pdfActive) },
    { label: "PDFs unavailable", value: String(chapters.length - pdfActive) },
    { label: "Audio available / testing", value: String(audioActive) },
    { label: "Audio unavailable", value: String(chapters.length - audioActive) },
    { label: "Testing resources", value: String(getTestingResourceCount()) },
  ];

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-tight">Resource status</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Read-only overview of the centralized PDF and audio resource manifest.
      </p>
      <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
        {rows.map((row) => (
          <div key={row.label} className="flex min-h-12 items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="shrink-0 font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-2 font-medium">#</th>
              <th scope="col" className="px-4 py-2 font-medium">Chapter</th>
              <th scope="col" className="px-4 py-2 font-medium">PDF</th>
              <th scope="col" className="px-4 py-2 font-medium">Audio</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((chapter) => (
              <tr key={chapter.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{chapter.number}</td>
                <td className="px-4 py-2">{chapter.title}</td>
                <td className="px-4 py-2 text-muted-foreground">{statusLabel(pdfStatus(chapter.id))}</td>
                <td className="px-4 py-2 text-muted-foreground">{statusLabel(audioStatus(chapter.id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <ResourceStatusSection />
      <SettingsSection title="Data" rows={dataRows} />
      <SettingsSection title="About" rows={aboutRows} />
      <p className="mt-6 text-xs text-muted-foreground">
        ENCOR Study · installable to your home screen from your browser's share menu.
      </p>
    </div>
  );
}
