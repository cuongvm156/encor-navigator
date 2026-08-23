import { createFileRoute, Link } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { chapters, resources } from "@/features/course/data";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — ENCOR Study" },
      {
        name: "description",
        content: "Find CCNP ENCOR chapters and study resources by keyword.",
      },
      { property: "og:title", content: "Search — ENCOR Study" },
      { property: "og:description", content: "Find CCNP ENCOR chapters and study resources by keyword." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const chapterHits = q
    ? chapters.filter((c) => `${c.title} ${c.summary}`.toLowerCase().includes(q))
    : [];
  const resourceHits = q
    ? resources.filter((r) => `${r.title} ${r.source}`.toLowerCase().includes(q))
    : [];

  return (
    <div>
      <PageHeader eyebrow="Find" title="Search" description="Search chapters and resources." />

      <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
        <SearchIcon className="size-4 text-muted-foreground" strokeWidth={1.75} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. OSPF, VXLAN, NetFlow"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {q ? (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-sm font-semibold tracking-tight">Chapters ({chapterHits.length})</h2>
            <ul className="mt-3 space-y-2">
              {chapterHits.map((chapter) => (
                <li key={chapter.id}>
                  <Link
                    to="/chapter/$chapterId"
                    params={{ chapterId: chapter.id }}
                    className="block rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-accent"
                  >
                    {chapter.number}. {chapter.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-sm font-semibold tracking-tight">Resources ({resourceHits.length})</h2>
            <ul className="mt-3 space-y-2">
              {resourceHits.map((resource) => (
                <li key={resource.id}>
                  <Link
                    to="/chapter/$chapterId"
                    params={{ chapterId: resource.chapterId }}
                    className="block rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-accent"
                  >
                    {resource.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">Start typing to search the course.</p>
      )}
    </div>
  );
}
