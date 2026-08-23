/**
 * Pure, deterministic offline search core (Sprint 5B).
 *
 * Sources: the in-memory course catalogue (9 parts / 29 technical chapters),
 * reader notes and reader bookmarks from the existing Dexie repositories.
 * No PDF text extraction, no audio content, no remote/semantic search.
 */

import type { Chapter, Part } from "@/features/course/types";
import type { ReaderBookmarkRecord, ReaderNoteRecord } from "@/db/schema";

import { foldText, stripLeadingZeros, tokenize } from "./normalize";

export type SearchResultKind = "part" | "chapter" | "note" | "bookmark";

export interface PartResult {
  kind: "part";
  id: string;
  part: Part;
  chapterCount: number;
  score: number;
}

export interface ChapterResult {
  kind: "chapter";
  id: string;
  chapter: Chapter;
  part?: Part;
  score: number;
}

export interface NoteResult {
  kind: "note";
  id: string;
  note: ReaderNoteRecord;
  chapter?: Chapter;
  score: number;
}

export interface BookmarkResult {
  kind: "bookmark";
  id: string;
  bookmark: ReaderBookmarkRecord;
  chapter?: Chapter;
  score: number;
}

export type SearchResult = PartResult | ChapterResult | NoteResult | BookmarkResult;

export interface SearchGroups {
  parts: PartResult[];
  chapters: ChapterResult[];
  notes: NoteResult[];
  bookmarks: BookmarkResult[];
  total: number;
}

export type AvailabilityFilter = "all" | "pdf" | "audio" | "offline";

export interface SearchFilters {
  type: SearchResultKind | "all";
  partId: string | "all";
  availability: AvailabilityFilter;
}

export const DEFAULT_FILTERS: SearchFilters = {
  type: "all",
  partId: "all",
  availability: "all",
};

export interface SearchSources {
  parts: Part[];
  chapters: Chapter[];
  notes: ReaderNoteRecord[];
  bookmarks: ReaderBookmarkRecord[];
  /** Chapter ids that have a ready offline binary. */
  offlineChapterIds?: Set<string>;
}

/** Ranking scores — higher wins. Documented order from the sprint spec. */
export const SCORE = {
  exactNumber: 1000,
  exactTitle: 900,
  titleStartsWith: 800,
  wholeWord: 700,
  allTokensInTitle: 600,
  noteBody: 500,
  bookmarkChapterPage: 400,
  partialSubstring: 300,
} as const;

interface Haystack {
  text: string;
  numbers: Set<string>;
}

function haystack(text: string, numbers: number[]): Haystack {
  return {
    text: foldText(text),
    numbers: new Set(numbers.map((n) => String(n))),
  };
}

/** Every meaningful query token must match. Numbers match whole tokens only. */
function matchesAll(tokens: string[], hay: Haystack): boolean {
  return tokens.every((raw) => {
    const token = stripLeadingZeros(raw);
    if (/^[0-9]+$/.test(token)) {
      if (hay.numbers.has(token)) return true;
      // also allow a number appearing as a standalone word in the text
      return new RegExp(`(^|[^0-9])0*${token}([^0-9]|$)`).test(hay.text);
    }
    return hay.text.includes(token);
  });
}

const wholeWord = (token: string, text: string) =>
  new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(text);

function titleScore(tokens: string[], title: string, numbers: number[]): number {
  const folded = foldText(title);
  const joined = tokens.join(" ");
  const numberTokens = tokens.filter((t) => /^[0-9]+$/.test(stripLeadingZeros(t)));
  const textTokens = tokens.filter((t) => !/^[0-9]+$/.test(stripLeadingZeros(t)));

  if (
    numberTokens.length > 0 &&
    numberTokens.every((t) => numbers.includes(Number(stripLeadingZeros(t))))
  ) {
    return SCORE.exactNumber;
  }
  if (folded === joined) return SCORE.exactTitle;
  if (folded.startsWith(joined)) return SCORE.titleStartsWith;
  if (textTokens.length > 0 && textTokens.every((t) => wholeWord(t, folded))) {
    return SCORE.wholeWord;
  }
  if (textTokens.length > 0 && textTokens.every((t) => folded.includes(t))) {
    return SCORE.allTokensInTitle;
  }
  return SCORE.partialSubstring;
}

function passesAvailability(
  chapter: Chapter | undefined,
  filters: SearchFilters,
  offline: Set<string>,
): boolean {
  if (filters.availability === "all") return true;
  if (!chapter) return false;
  if (filters.availability === "pdf") return Boolean(chapter.pdfUrl);
  if (filters.availability === "audio") return Boolean(chapter.audioUrl);
  return offline.has(chapter.id);
}

export function runSearch(
  query: string,
  sources: SearchSources,
  filters: SearchFilters = DEFAULT_FILTERS,
): SearchGroups {
  const tokens = tokenize(query);
  const empty: SearchGroups = { parts: [], chapters: [], notes: [], bookmarks: [], total: 0 };
  if (tokens.length === 0) return empty;

  const offline = sources.offlineChapterIds ?? new Set<string>();
  const chapterById = new Map(sources.chapters.map((c) => [c.id, c]));
  const partById = new Map(sources.parts.map((p) => [p.id, p]));

  const wantsType = (kind: SearchResultKind) => filters.type === "all" || filters.type === kind;

  const parts: PartResult[] = [];
  if (wantsType("part") && filters.availability === "all") {
    for (const part of sources.parts) {
      if (filters.partId !== "all" && filters.partId !== part.id) continue;
      const hay = haystack(`part ${part.number} ${part.title}`, [part.number]);
      if (!matchesAll(tokens, hay)) continue;
      parts.push({
        kind: "part",
        id: part.id,
        part,
        chapterCount: sources.chapters.filter((c) => c.partId === part.id).length,
        score: titleScore(tokens, part.title, [part.number]),
      });
    }
  }

  const chapters: ChapterResult[] = [];
  if (wantsType("chapter")) {
    for (const chapter of sources.chapters) {
      if (filters.partId !== "all" && filters.partId !== chapter.partId) continue;
      if (!passesAvailability(chapter, filters, offline)) continue;
      const part = partById.get(chapter.partId);
      const padded = String(chapter.number).padStart(2, "0");
      const hay = haystack(
        `chapter ${chapter.number} ch ${chapter.number} ch${padded} ${chapter.title} ${part?.title ?? ""}`,
        [chapter.number],
      );
      if (!matchesAll(tokens, hay)) continue;
      chapters.push({
        kind: "chapter",
        id: chapter.id,
        chapter,
        ...(part ? { part } : {}),
        score: titleScore(tokens, chapter.title, [chapter.number]),
      });
    }
  }

  const notes: NoteResult[] = [];
  if (wantsType("note")) {
    for (const note of sources.notes) {
      const chapter = chapterById.get(note.chapterId);
      if (filters.partId !== "all" && chapter?.partId !== filters.partId) continue;
      if (!passesAvailability(chapter, filters, offline)) continue;
      const hay = haystack(
        `${note.body} chapter ${chapter?.number ?? ""} ${chapter?.title ?? ""} page ${note.pageNumber}`,
        [note.pageNumber, ...(chapter ? [chapter.number] : [])],
      );
      if (!matchesAll(tokens, hay)) continue;
      const bodyHit = tokens.some((t) => foldText(note.body).includes(stripLeadingZeros(t)));
      notes.push({
        kind: "note",
        id: note.id,
        note,
        ...(chapter ? { chapter } : {}),
        score: bodyHit ? SCORE.noteBody : SCORE.partialSubstring,
      });
    }
  }

  const bookmarks: BookmarkResult[] = [];
  if (wantsType("bookmark")) {
    for (const bookmark of sources.bookmarks) {
      const chapter = chapterById.get(bookmark.chapterId);
      if (filters.partId !== "all" && chapter?.partId !== filters.partId) continue;
      if (!passesAvailability(chapter, filters, offline)) continue;
      const hay = haystack(
        `bookmark chapter ${chapter?.number ?? ""} ${chapter?.title ?? ""} page ${bookmark.pageNumber}`,
        [bookmark.pageNumber, ...(chapter ? [chapter.number] : [])],
      );
      if (!matchesAll(tokens, hay)) continue;
      bookmarks.push({
        kind: "bookmark",
        id: bookmark.id,
        bookmark,
        ...(chapter ? { chapter } : {}),
        score: SCORE.bookmarkChapterPage,
      });
    }
  }

  parts.sort((a, b) => b.score - a.score || a.part.number - b.part.number);
  chapters.sort((a, b) => b.score - a.score || a.chapter.number - b.chapter.number);
  notes.sort((a, b) => b.score - a.score || b.note.updatedAt.localeCompare(a.note.updatedAt));
  bookmarks.sort(
    (a, b) => b.score - a.score || b.bookmark.updatedAt.localeCompare(a.bookmark.updatedAt),
  );

  return {
    parts,
    chapters,
    notes,
    bookmarks,
    total: parts.length + chapters.length + notes.length + bookmarks.length,
  };
}

/** Match ranges for safe highlighting — index pairs into the ORIGINAL string. */
export function matchRanges(text: string, query: string): Array<[number, number]> {
  const tokens = Array.from(
    new Set(tokenize(query).filter((t) => t.length >= (/^[0-9]+$/.test(t) ? 1 : 2))),
  );
  if (tokens.length === 0) return [];
  const folded = foldText(text);
  // foldText only lowercases / strips diacritics, so indexes stay aligned when
  // the source has no collapsed whitespace; guard against length drift.
  if (folded.length !== text.length) return [];
  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(token, from);
      if (at === -1) break;
      ranges.push([at, at + token.length]);
      from = at + token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range] as [number, number]);
  }
  return merged;
}

/** Short snippet around the first match, for note bodies. */
export function snippet(text: string, query: string, radius = 90): string {
  const ranges = matchRanges(text, query);
  const first = ranges[0]?.[0] ?? 0;
  const start = Math.max(0, first - radius);
  const end = Math.min(text.length, first + radius * 2);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
