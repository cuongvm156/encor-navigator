import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { useLiveProgress } from "@/features/progress/useLiveProgress";
import { readingRatioOf, audioRatioOf, toPercent } from "@/features/progress/weights";
import { parts } from "@/features/course/data";
import { Highlight } from "@/features/search/Highlight";
import { isSearchable } from "@/features/search/normalize";
import {
  snippet,
  type AvailabilityFilter,
  type SearchFilters,
  type SearchResult,
  type SearchResultKind,
} from "@/features/search/searchCore";
import { useSearchResults } from "@/features/search/useSearchResults";

interface SearchParams {
  q: string;
  type: SearchResultKind | "all";
  part: string;
  avail: AvailabilityFilter;
}

const TYPES: Array<{ value: SearchParams["type"]; label: string }> = [
  { value: "all", label: "All" },
  { value: "part", label: "Parts" },
  { value: "chapter", label: "Chapters" },
  { value: "note", label: "Notes" },
  { value: "bookmark", label: "Bookmarks" },
];

const AVAILABILITY: Array<{ value: AvailabilityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pdf", label: "PDF available" },
  { value: "audio", label: "Audio available" },
  { value: "offline", label: "Offline available" },
];

const asString = (value: unknown, fallback: string) =>
  typeof value === "string" && value.length > 0 ? value : fallback;

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: asString(search["q"], ""),
    type: (["all", "part", "chapter", "note", "bookmark"] as const).includes(
      search["type"] as SearchResultKind | "all",
    )
      ? (search["type"] as SearchParams["type"])
      : "all",
    part: asString(search["part"], "all"),
    avail: (["all", "pdf", "audio", "offline"] as const).includes(
      search["avail"] as AvailabilityFilter,
    )
      ? (search["avail"] as AvailabilityFilter)
      : "all",
  }),
  head: () => {
    const title = "Search — ENCOR Study";
    const description =
      "Search the CCNP ENCOR 350-401 parts, chapters, notes and bookmarks offline on this device.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: SearchPage,
});

const chipClass = (active: boolean) =>
  `inline-flex min-h-9 items-center rounded-full border px-3 text-xs transition-colors ${
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border text-muted-foreground hover:bg-accent"
  }`;

const GROUP_LIMIT = 5;

function SearchPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [input, setInput] = useState(params.q);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => setInput(params.q), [params.q]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced URL sync so refresh / Back preserve the query.
  useEffect(() => {
    if (input === params.q) return;
    const timer = window.setTimeout(() => {
      void navigate({ search: (prev) => ({ ...prev, q: input }), replace: true });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [input, params.q, navigate]);

  const filters: SearchFilters = useMemo(
    () => ({ type: params.type, partId: params.part, availability: params.avail }),
    [params.type, params.part, params.avail],
  );

  const query = input;
  const searchable = isSearchable(query);
  const { groups, loading, error } = useSearchResults(searchable ? query : "", filters);
  const { progressById } = useLiveProgress();

  const flat: SearchResult[] = useMemo(
    () => [
      ...groups.parts.slice(0, expanded["part"] ? undefined : GROUP_LIMIT),
      ...groups.chapters.slice(0, expanded["chapter"] ? undefined : GROUP_LIMIT),
      ...groups.notes.slice(0, expanded["note"] ? undefined : GROUP_LIMIT),
      ...groups.bookmarks.slice(0, expanded["bookmark"] ? undefined : GROUP_LIMIT),
    ],
    [groups, expanded],
  );

  useEffect(() => setActive(-1), [query, params.type, params.part, params.avail]);

  const openResult = (result: SearchResult) => {
    inputRef.current?.blur();
    if (result.kind === "part") {
      void navigate({ to: "/course" });
      return;
    }
    if (result.kind === "chapter") {
      void navigate({ to: "/chapter/$chapterId", params: { chapterId: result.chapter.id } });
      return;
    }
    const record = result.kind === "note" ? result.note : result.bookmark;
    void navigate({
      to: "/reader/$chapterId",
      params: { chapterId: record.chapterId },
      search: { page: record.pageNumber },
    });
  };


  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (event.key === "Enter") {
      const result = flat[active];
      if (result) {
        event.preventDefault();
        openResult(result);
      }
    } else if (event.key === "Escape") {
      if (input) setInput("");
      else inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (active < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-result-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const setFilter = (patch: Partial<SearchParams>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const resetFilters = () => setFilter({ type: "all", part: "all", avail: "all" });

  let index = -1;
  const nextIndex = () => ++index;

  const rowClass = (i: number) =>
    `block rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      i === active ? "border-foreground bg-accent" : "border-border hover:bg-accent"
    }`;

  return (
    <div>
      <PageHeader
        eyebrow="Search"
        title="Find anything offline"
        description="Search runs locally on this device. Notes and learning data are not uploaded."
      />

      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <input
          ref={inputRef}
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search parts, chapters, notes, bookmarks…"
          aria-label="Search"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls="search-results"
          autoComplete="off"
          className="h-12 w-full rounded-lg border border-input bg-background pl-9 pr-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {input ? (
          <button
            type="button"
            onClick={() => {
              setInput("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={chipClass(params.type === t.value)}
              onClick={() => setFilter({ type: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={chipClass(params.part === "all")}
            onClick={() => setFilter({ part: "all" })}
          >
            All parts
          </button>
          {parts.map((part) => (
            <button
              key={part.id}
              type="button"
              className={chipClass(params.part === part.id)}
              onClick={() => setFilter({ part: part.id })}
            >
              Part {part.number}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {AVAILABILITY.map((a) => (
            <button
              key={a.value}
              type="button"
              className={chipClass(params.avail === a.value)}
              onClick={() => setFilter({ avail: a.value })}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div id="search-results" ref={listRef} role="listbox" aria-label="Search results" className="mt-6 space-y-8">
        {error ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{error}</p>
        ) : !searchable ? (
          <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            <p>Try one of these:</p>
            <ul className="mt-2 space-y-1">
              {["OSPF", "Chapter 14", "Packet Forwarding", "Page 12"].map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    className="min-h-9 text-left text-foreground underline underline-offset-2"
                    onClick={() => setInput(example)}
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : loading && groups.total === 0 ? (
          <p className="text-sm text-muted-foreground">Loading your notes and bookmarks…</p>
        ) : groups.total === 0 ? (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm">No matching Parts, Chapters, Notes or Bookmarks.</p>
            <button
              type="button"
              onClick={() => setInput("")}
              className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            {groups.parts.length > 0 ? (
              <Group
                title="Parts"
                count={groups.parts.length}
                expanded={Boolean(expanded["part"])}
                onToggle={() => setExpanded((e) => ({ ...e, part: !e["part"] }))}
              >
                {groups.parts
                  .slice(0, expanded["part"] ? undefined : GROUP_LIMIT)
                  .map((result) => {
                    const i = nextIndex();
                    return (
                      <Link
                        key={result.id}
                        to="/course"
                        role="option"
                        aria-selected={i === active}
                        data-result-index={i}
                        className={rowClass(i)}
                      >
                        <p className="text-xs text-muted-foreground">Part {result.part.number}</p>
                        <p className="mt-1 text-sm font-medium">
                          <Highlight text={result.part.title} query={query} />
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {result.chapterCount} chapters · Open part
                        </p>
                      </Link>
                    );
                  })}
              </Group>
            ) : null}

            {groups.chapters.length > 0 ? (
              <Group
                title="Chapters"
                count={groups.chapters.length}
                expanded={Boolean(expanded["chapter"])}
                onToggle={() => setExpanded((e) => ({ ...e, chapter: !e["chapter"] }))}
              >
                {groups.chapters
                  .slice(0, expanded["chapter"] ? undefined : GROUP_LIMIT)
                  .map((result) => {
                    const i = nextIndex();
                    const progress = progressById[result.chapter.id];
                    return (
                      <Link
                        key={result.id}
                        to="/chapter/$chapterId"
                        params={{ chapterId: result.chapter.id }}
                        role="option"
                        aria-selected={i === active}
                        data-result-index={i}
                        className={rowClass(i)}
                      >
                        <p className="text-xs text-muted-foreground">
                          Chapter {result.chapter.number}
                          {result.part ? ` · Part ${result.part.number} ${result.part.title}` : ""}
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          <Highlight text={result.chapter.title} query={query} />
                        </p>
                        <div className="mt-3 space-y-2">
                          <ProgressBar
                            ratio={readingRatioOf(progress)}
                            label={`Reading ${toPercent(readingRatioOf(progress))}%`}
                          />
                          <ProgressBar
                            ratio={audioRatioOf(progress)}
                            label={`Audio ${toPercent(audioRatioOf(progress))}%`}
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {result.chapter.pdfUrl ? "PDF available" : "PDF unavailable"} ·{" "}
                          {result.chapter.audioUrl ? "Audio available" : "Audio unavailable"}
                        </p>
                      </Link>
                    );
                  })}
              </Group>
            ) : null}

            {groups.notes.length > 0 ? (
              <Group
                title="Notes"
                count={groups.notes.length}
                expanded={Boolean(expanded["note"])}
                onToggle={() => setExpanded((e) => ({ ...e, note: !e["note"] }))}
              >
                {groups.notes
                  .slice(0, expanded["note"] ? undefined : GROUP_LIMIT)
                  .map((result) => {
                    const i = nextIndex();
                    const text = snippet(result.note.body, query);
                    return (
                      <Link
                        key={result.id}
                        to="/reader/$chapterId"
                        params={{ chapterId: result.note.chapterId }}
                        search={{ page: result.note.pageNumber }}
                        role="option"
                        aria-selected={i === active}
                        data-result-index={i}
                        className={rowClass(i)}
                      >
                        <p className="text-sm">
                          <Highlight text={text} query={query} />
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {result.chapter
                            ? `Chapter ${result.chapter.number}. ${result.chapter.title}`
                            : result.note.chapterId}{" "}
                          · Page {result.note.pageNumber} ·{" "}
                          {new Date(result.note.updatedAt).toLocaleDateString()} · Open page
                        </p>
                      </Link>
                    );
                  })}
              </Group>
            ) : null}

            {groups.bookmarks.length > 0 ? (
              <Group
                title="Bookmarks"
                count={groups.bookmarks.length}
                expanded={Boolean(expanded["bookmark"])}
                onToggle={() => setExpanded((e) => ({ ...e, bookmark: !e["bookmark"] }))}
              >
                {groups.bookmarks
                  .slice(0, expanded["bookmark"] ? undefined : GROUP_LIMIT)
                  .map((result) => {
                    const i = nextIndex();
                    return (
                      <Link
                        key={result.id}
                        to="/reader/$chapterId"
                        params={{ chapterId: result.bookmark.chapterId }}
                        search={{ page: result.bookmark.pageNumber }}
                        role="option"
                        aria-selected={i === active}
                        data-result-index={i}
                        className={rowClass(i)}
                      >
                        <p className="text-sm font-medium">
                          {result.chapter ? (
                            <Highlight
                              text={`${result.chapter.number}. ${result.chapter.title}`}
                              query={query}
                            />
                          ) : (
                            result.bookmark.chapterId
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Page {result.bookmark.pageNumber} · Open page
                        </p>
                      </Link>
                    );
                  })}
              </Group>
            ) : null}
          </>
        )}
      </div>

      <p className="mt-8 pb-4 text-xs text-muted-foreground">
        Search runs locally on this device. Notes and learning data are not uploaded.
      </p>
    </div>
  );
}

function Group({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">
          {title} <span className="text-muted-foreground">({count})</span>
        </h2>
        {count > GROUP_LIMIT ? (
          <button
            type="button"
            onClick={onToggle}
            className="min-h-9 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {expanded ? "Show less" : `Show all ${count}`}
          </button>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}
