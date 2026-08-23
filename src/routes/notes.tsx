import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, FileText, Headphones } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getChapter, notes } from "@/features/course/data";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes & Bookmarks — ENCOR Study" },
      {
        name: "description",
        content: "Every note and bookmark you saved while studying CCNP ENCOR 350-401 chapters.",
      },
      { property: "og:title", content: "Notes & Bookmarks — ENCOR Study" },
      {
        property: "og:description",
        content: "Your saved notes and bookmarks across CCNP ENCOR 350-401 chapters.",
      },
    ],
  }),
  component: NotesPage,
});

const tabs = [
  { key: "note" as const, label: "Notes" },
  { key: "bookmark" as const, label: "Bookmarks" },
];

function NotesPage() {
  const [tab, setTab] = useState<"note" | "bookmark">("note");
  const items = notes.filter((n) => n.kind === tab);

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Notes & bookmarks"
        description="Saved highlights from your reading and listening sessions."
      />

      <div
        className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1"
        role="tablist"
        aria-label="Notes and bookmarks"
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`min-h-10 rounded-md px-3 text-sm transition-colors ${
                active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              {t.label} ({notes.filter((n) => n.kind === t.key).length})
            </button>
          );
        })}
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((note) => {
          const chapter = getChapter(note.chapterId);
          const locator = note.page ? `PDF Page ${note.page}` : note.time ? `Audio ${note.time}` : "";
          const LocatorIcon = note.page ? FileText : Headphones;
          return (
            <li key={note.id}>
              <Link
                to="/chapter/$chapterId"
                params={{ chapterId: note.chapterId }}
                className="block rounded-lg border border-border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm">{note.body}</p>
                  {note.kind === "note" && note.type ? (
                    <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {note.type}
                    </span>
                  ) : (
                    <Bookmark className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  )}
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{chapter ? `Ch ${chapter.number} · ${chapter.title}` : "Chapter"}</span>
                  {locator ? (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <LocatorIcon className="size-3.5" strokeWidth={1.75} />
                      {locator}
                    </span>
                  ) : null}
                  <span className="tabular-nums">{note.createdAt}</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
