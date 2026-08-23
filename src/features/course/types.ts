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
  lastOpened?: string;
}
