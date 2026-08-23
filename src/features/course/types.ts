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
  summary: string;
  minutes: number;
  objectives: string[];
}

export interface Part {
  id: string;
  number: number;
  title: string;
  description: string;
  examWeight: number;
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
