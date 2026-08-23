export type ResourceKind = "reading" | "video" | "audio" | "notes" | "link";

export interface Resource {
  id: string;
  chapterId: string;
  title: string;
  kind: ResourceKind;
  minutes: number;
  source: string;
}

export interface Chapter {
  id: string;
  partId: string;
  number: number;
  title: string;
  /** Optional — only set when confirmed content exists. Never estimated. */
  summary?: string;
  /** Optional study minutes. Never estimated; UI hides the row when absent. */
  minutes?: number;
  /** Optional confirmed objectives. UI hides the section when absent. */
  objectives?: string[];
  /** Optional chapter PDF served from the app origin (e.g. /pdfs/foo.pdf). */
  pdfUrl?: string;
  /**
   * Reading-state identity for `pdfUrl`. Distinct per document version, so
   * replacing the document starts a fresh reading state instead of inheriting
   * pages from a different document. Never reuse a generic id like "pdf".
   */
  pdfResourceId?: string;
}

export interface Part {
  id: string;
  number: number;
  title: string;
  /** Optional — omitted for official book parts with no confirmed blurb. */
  description?: string;
  /** Optional — never invented for book parts. */
  examWeight?: number;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  vendor: string;
  description: string;
  parts: Part[];
}

export interface ChapterProgress {
  chapterId: string;
  /** 0..1 — portion of the chapter reading completed */
  readRatio: number;
  /** 0..1 — portion of the chapter resources completed */
  resourceRatio: number;
  /** 0..1 — portion of the chapter audio listened to */
  audioRatio?: number;
  lastOpened?: string;
}

/** Demo classification for a written note. */
export type NoteType = "Note" | "Important" | "Review";

/** Where a bookmark points to. */
export type BookmarkTarget = "pdf" | "audio";

export interface Note {
  id: string;
  chapterId: string;
  kind: "note" | "bookmark";
  body: string;
  createdAt: string;
  /** PDF page for reading notes and PDF bookmarks */
  page?: number;
  /** Audio timestamp label (mm:ss) for audio notes and bookmarks */
  time?: string;
  /** Note classification — notes only */
  type?: NoteType;
  /** Bookmark target — bookmarks only */
  target?: BookmarkTarget;
}
