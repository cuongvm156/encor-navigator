import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, StickyNote } from "lucide-react";
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

const groups = [
  { kind: "note" as const, title: "Notes", icon: StickyNote },
  { kind: "bookmark" as const, title: "Bookmarks", icon: Bookmark },
];

function NotesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Notes & bookmarks"
        description="Saved highlights from your chapter reading sessions."
      />
      <div className="space-y-8">
        {groups.map((group) => {
          const items = notes.filter((n) => n.kind === group.kind);
          if (items.length === 0) return null;
          return (
            <section key={group.kind}>
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <group.icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
                {group.title} ({items.length})
              </h2>
              <ul className="mt-3 space-y-2">
                {items.map((note) => {
                  const chapter = getChapter(note.chapterId);
                  return (
                    <li key={note.id}>
                      <Link
                        to="/chapter/$chapterId"
                        params={{ chapterId: note.chapterId }}
                        className="block rounded-lg border border-border px-4 py-3 transition-colors hover:bg-accent"
                      >
                        <p className="text-sm">{note.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {chapter ? `Ch ${chapter.number} · ${chapter.title}` : "Chapter"}
                          {note.page ? ` · p.${note.page}` : ""} · {note.createdAt}
                        </p>
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
