/**
 * Live (Dexie liveQuery) access to reader notes and bookmarks.
 *
 * UI never touches Dexie directly — everything goes through the repositories.
 */

import { useLiveQuery } from "dexie-react-hooks";

import {
  bookmarksRepository,
  readerNotesRepository,
  type ReaderBookmarkRecord,
  type ReaderNoteRecord,
} from "@/repositories/readerAnnotationsRepository";

export function useAllAnnotations(): {
  notes: ReaderNoteRecord[];
  bookmarks: ReaderBookmarkRecord[];
  ready: boolean;
} {
  const notes = useLiveQuery(() => readerNotesRepository.getAll(), [], undefined);
  const bookmarks = useLiveQuery(() => bookmarksRepository.getAll(), [], undefined);
  return {
    notes: notes ?? [],
    bookmarks: bookmarks ?? [],
    ready: notes !== undefined && bookmarks !== undefined,
  };
}

export function useChapterAnnotationCounts(chapterId: string) {
  const notes = useLiveQuery(() => readerNotesRepository.getByChapter(chapterId), [chapterId], undefined);
  const bookmarks = useLiveQuery(() => bookmarksRepository.getByChapter(chapterId), [chapterId], undefined);
  return { noteCount: notes?.length ?? 0, bookmarkCount: bookmarks?.length ?? 0 };
}

/** Page-scoped state for the Reader controls. */
export function usePageAnnotations(pdfResourceId: string | undefined, pageNumber: number) {
  const enabled = Boolean(pdfResourceId);
  const bookmark = useLiveQuery(
    () => (pdfResourceId ? bookmarksRepository.getByPage(pdfResourceId, pageNumber) : undefined),
    [pdfResourceId, pageNumber],
    undefined,
  );
  const notes = useLiveQuery(
    () => (pdfResourceId ? readerNotesRepository.getByPage(pdfResourceId, pageNumber) : []),
    [pdfResourceId, pageNumber],
    [] as ReaderNoteRecord[],
  );
  return {
    enabled,
    isBookmarked: Boolean(bookmark),
    pageNotes: notes ?? [],
    noteCount: notes?.length ?? 0,
  };
}
