import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, FileText, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { NoteComposer } from "@/features/annotations/NoteComposer";
import { useAllAnnotations } from "@/features/annotations/useAnnotations";
import { chapters, getChapter, parts } from "@/features/course/data";
import {
  bookmarksRepository,
  readerNotesRepository,
  type ReaderBookmarkRecord,
  type ReaderNoteRecord,
} from "@/repositories/readerAnnotationsRepository";

type TabKey = "all" | "notes" | "bookmarks";

export const Route = createFileRoute("/notes")({
  validateSearch: (search: Record<string, unknown>): { chapter?: string; tab?: TabKey } => {
    const chapter = typeof search["chapter"] === "string" ? search["chapter"] : undefined;
    const tab = search["tab"];
    const result: { chapter?: string; tab?: TabKey } = {};
    if (chapter) result.chapter = chapter;
    if (tab === "all" || tab === "notes" || tab === "bookmarks") result.tab = tab;
    return result;
  },
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

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notes", label: "Notes" },
  { key: "bookmarks", label: "Bookmarks" },
];

const selectClass =
  "min-h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground";

const chip =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-input px-2.5 text-xs transition-colors hover:bg-accent";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

function NotesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/notes" });
  const { notes, bookmarks, ready } = useAllAnnotations();

  const [tab, setTab] = useState<TabKey>(search.tab ?? "all");
  const [query, setQuery] = useState("");
  const [partId, setPartId] = useState("all");
  const [chapterId, setChapterId] = useState(search.chapter ?? "all");
  const [editing, setEditing] = useState<ReaderNoteRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReaderNoteRecord | null>(null);

  const chapterOptions = useMemo(
    () => (partId === "all" ? chapters : chapters.filter((c) => c.partId === partId)),
    [partId],
  );

  const matches = (record: { chapterId: string }, body?: string) => {
    const chapter = getChapter(record.chapterId);
    if (partId !== "all" && chapter?.partId !== partId) return false;
    if (chapterId !== "all" && record.chapterId !== chapterId) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (body ?? "").toLowerCase().includes(q) || (chapter?.title ?? "").toLowerCase().includes(q)
    );
  };

  const visibleNotes = tab === "bookmarks" ? [] : notes.filter((n) => matches(n, n.body));
  const visibleBookmarks = tab === "notes" ? [] : bookmarks.filter((b) => matches(b));

  const items = [
    ...visibleNotes.map((n) => ({ kind: "note" as const, record: n, sortKey: n.updatedAt })),
    ...visibleBookmarks.map((b) => ({
      kind: "bookmark" as const,
      record: b,
      sortKey: b.updatedAt,
    })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const setTabAndUrl = (key: TabKey) => {
    setTab(key);
    void navigate({ search: (prev) => ({ ...prev, tab: key }), replace: true });
  };

  const deleteNote = async () => {
    if (!pendingDelete) return;
    await readerNotesRepository.remove(pendingDelete.id);
    setPendingDelete(null);
    toast.success("Note deleted");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Notes & bookmarks"
        description="Saved highlights from your reading sessions, stored offline on this device."
      />

      <div
        className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1"
        role="tablist"
        aria-label="Notes and bookmarks"
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          const count =
            t.key === "all" ? notes.length + bookmarks.length : t.key === "notes" ? notes.length : bookmarks.length;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTabAndUrl(t.key)}
              className={`min-h-10 rounded-md px-3 text-sm transition-colors ${
                active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes or chapters"
          aria-label="Search notes or chapters"
          className="h-10"
        />
        <select
          className={selectClass}
          aria-label="Filter by part"
          value={partId}
          onChange={(event) => {
            setPartId(event.target.value);
            setChapterId("all");
          }}
        >
          <option value="all">All parts</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              Part {p.number} · {p.title}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          aria-label="Filter by chapter"
          value={chapterId}
          onChange={(event) => setChapterId(event.target.value)}
        >
          <option value="all">All chapters</option>
          {chapterOptions.map((c) => (
            <option key={c.id} value={c.id}>
              Ch {c.number} · {c.title}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {ready
            ? "No notes or bookmarks yet. Open a chapter PDF and use Bookmark this page or Add note."
            : "Loading…"}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) =>
            item.kind === "note" ? (
              <NoteItem
                key={item.record.id}
                note={item.record}
                onEdit={() => setEditing(item.record)}
                onDelete={() => setPendingDelete(item.record)}
              />
            ) : (
              <BookmarkItem key={item.record.id} bookmark={item.record} />
            ),
          )}
        </ul>
      )}

      <NoteComposer
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        mode="edit"
        chapterTitle={
          editing
            ? `${getChapter(editing.chapterId)?.number ?? ""}. ${getChapter(editing.chapterId)?.title ?? ""}`
            : ""
        }
        pageNumber={editing?.pageNumber ?? 1}
        initialBody={editing?.body ?? ""}
        onSave={async (body) => {
          if (!editing) return;
          await readerNotesRepository.update(editing.id, body);
          toast.success("Note updated");
        }}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the note from this device. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteNote()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChapterLine({ chapterId, page }: { chapterId: string; page: number }) {
  const chapter = getChapter(chapterId);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>{chapter ? `Ch ${chapter.number} · ${chapter.title}` : chapterId}</span>
      <span className="inline-flex items-center gap-1 tabular-nums">
        <FileText className="size-3.5" strokeWidth={1.75} />
        PDF page {page}
      </span>
    </p>
  );
}

function NoteItem({
  note,
  onEdit,
  onDelete,
}: {
  note: ReaderNoteRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-lg border border-border px-4 py-3">
      <p className="text-sm whitespace-pre-wrap">{note.body}</p>
      <div className="mt-1.5">
        <ChapterLine chapterId={note.chapterId} page={note.pageNumber} />
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        Updated {formatDate(note.updatedAt)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to="/reader/$chapterId"
          params={{ chapterId: note.chapterId }}
          search={{ page: note.pageNumber }}
          className={chip}
        >
          Open page
        </Link>
        <button type="button" className={chip} onClick={onEdit}>
          <Pencil className="mr-1 size-3.5" strokeWidth={1.75} />
          Edit
        </button>
        <button type="button" className={chip} onClick={onDelete}>
          <Trash2 className="mr-1 size-3.5" strokeWidth={1.75} />
          Delete
        </button>
      </div>
    </li>
  );
}

function BookmarkItem({ bookmark }: { bookmark: ReaderBookmarkRecord }) {
  const remove = async () => {
    await bookmarksRepository.remove(bookmark.id);
    toast.success("Bookmark removed");
  };

  return (
    <li className="rounded-lg border border-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <ChapterLine chapterId={bookmark.chapterId} page={bookmark.pageNumber} />
        <Bookmark className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        Created {formatDate(bookmark.createdAt)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to="/reader/$chapterId"
          params={{ chapterId: bookmark.chapterId }}
          search={{ page: bookmark.pageNumber }}
          className={chip}
        >
          Open page
        </Link>
        <button type="button" className={chip} onClick={() => void remove()}>
          <Trash2 className="mr-1 size-3.5" strokeWidth={1.75} />
          Remove bookmark
        </button>
      </div>
    </li>
  );
}
