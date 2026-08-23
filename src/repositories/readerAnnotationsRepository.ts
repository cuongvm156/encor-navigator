/**
 * Reader annotations repository (Sprint 3D) — the only access layer to the
 * `readerNotes` and `readerBookmarks` tables.
 *
 * Both records are identified by the document identity (`pdfResourceId`) plus
 * a 1-based `pageNumber`. A page may hold many notes but at most one bookmark
 * (enforced by the `&[pdfResourceId+pageNumber]` unique index).
 */

import { getDb } from "@/db/database";
import type { ReaderBookmarkRecord, ReaderNoteRecord } from "@/db/schema";

const now = () => new Date().toISOString();

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const byUpdatedDesc = <T extends { updatedAt: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const bookmarksRepository = {
  async getAll(): Promise<ReaderBookmarkRecord[]> {
    const db = getDb();
    if (!db) return [];
    return byUpdatedDesc(await db.readerBookmarks.toArray());
  },

  async getByChapter(chapterId: string): Promise<ReaderBookmarkRecord[]> {
    const db = getDb();
    if (!db) return [];
    return byUpdatedDesc(
      await db.readerBookmarks.where("chapterId").equals(chapterId).toArray(),
    );
  },

  async getByPage(
    pdfResourceId: string,
    pageNumber: number,
  ): Promise<ReaderBookmarkRecord | undefined> {
    const db = getDb();
    if (!db) return undefined;
    return db.readerBookmarks.get({ pdfResourceId, pageNumber });
  },

  async isBookmarked(pdfResourceId: string, pageNumber: number): Promise<boolean> {
    return Boolean(await bookmarksRepository.getByPage(pdfResourceId, pageNumber));
  },

  async add(
    chapterId: string,
    pdfResourceId: string,
    pageNumber: number,
  ): Promise<ReaderBookmarkRecord | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const existing = await bookmarksRepository.getByPage(pdfResourceId, pageNumber);
    if (existing) return existing;
    const record: ReaderBookmarkRecord = {
      id: newId(),
      chapterId,
      pdfResourceId,
      pageNumber,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.readerBookmarks.put(record);
    return record;
  },

  /** Removes a single bookmark by id. */
  async remove(id: string): Promise<void> {
    const db = getDb();
    if (!db) return;
    await db.readerBookmarks.delete(id);
  },

  /** Removes only the bookmark for this exact document page. */
  async removeByPage(pdfResourceId: string, pageNumber: number): Promise<void> {
    const existing = await bookmarksRepository.getByPage(pdfResourceId, pageNumber);
    if (existing) await bookmarksRepository.remove(existing.id);
  },

  /** Returns the new bookmarked state. */
  async toggle(
    chapterId: string,
    pdfResourceId: string,
    pageNumber: number,
  ): Promise<boolean> {
    const existing = await bookmarksRepository.getByPage(pdfResourceId, pageNumber);
    if (existing) {
      await bookmarksRepository.remove(existing.id);
      return false;
    }
    await bookmarksRepository.add(chapterId, pdfResourceId, pageNumber);
    return true;
  },
};

export const readerNotesRepository = {
  async getAll(): Promise<ReaderNoteRecord[]> {
    const db = getDb();
    if (!db) return [];
    return byUpdatedDesc(await db.readerNotes.toArray());
  },

  async getByChapter(chapterId: string): Promise<ReaderNoteRecord[]> {
    const db = getDb();
    if (!db) return [];
    return byUpdatedDesc(await db.readerNotes.where("chapterId").equals(chapterId).toArray());
  },

  async getByPage(pdfResourceId: string, pageNumber: number): Promise<ReaderNoteRecord[]> {
    const db = getDb();
    if (!db) return [];
    return byUpdatedDesc(
      await db.readerNotes.where("[pdfResourceId+pageNumber]").equals([pdfResourceId, pageNumber]).toArray(),
    );
  },

  /** Rejects empty / whitespace-only bodies. */
  async create(input: {
    chapterId: string;
    pdfResourceId: string;
    pageNumber: number;
    body: string;
  }): Promise<ReaderNoteRecord | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const body = input.body.trim();
    if (!body) throw new Error("Note body cannot be empty");
    const record: ReaderNoteRecord = {
      id: newId(),
      chapterId: input.chapterId,
      pdfResourceId: input.pdfResourceId,
      pageNumber: input.pageNumber,
      body,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.readerNotes.put(record);
    return record;
  },

  async update(id: string, body: string): Promise<ReaderNoteRecord | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Note body cannot be empty");
    const existing = await db.readerNotes.get(id);
    if (!existing) return undefined;
    const next: ReaderNoteRecord = { ...existing, body: trimmed, updatedAt: now() };
    await db.readerNotes.put(next);
    return next;
  },

  async remove(id: string): Promise<void> {
    const db = getDb();
    if (!db) return;
    await db.readerNotes.delete(id);
  },
};

export type { ReaderBookmarkRecord, ReaderNoteRecord };
