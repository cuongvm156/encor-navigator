/**
 * Reader page state (Sprint 3A).
 *
 * Resume uses `lastPage`; the progress measure is `maxPageReached`, which never
 * decreases. Demo `ChapterProgress` values are never used here.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { progressRepository } from "@/repositories/progressRepository";
import { readingRepository } from "@/repositories/readingRepository";

/**
 * Reading state is keyed by the chapter's document identity (`pdfResourceId`),
 * not a generic "pdf" id: a new document version gets its own record starting
 * at page 1, and older records stay untouched in IndexedDB.
 */

const clampPage = (page: number, totalPages: number) =>
  Math.min(Math.max(1, Math.round(page)), Math.max(1, totalPages));

export interface ReaderState {
  currentPage: number;
  maxPageReached: number;
  totalPages: number;
  ready: boolean;
  readingRatio: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

export function useReaderState(
  chapterId: string,
  resourceId: string | undefined,
  totalPages: number,
  /**
   * Optional deep-link page (e.g. `/reader/ch-01?page=12`). Overrides the saved
   * `lastPage` for this navigation and is then persisted as the new `lastPage`.
   * `maxPageReached` is never lowered by it.
   */
  requestedPage?: number | undefined,
): ReaderState {
  const [currentPage, setCurrentPage] = useState(1);
  const [maxPageReached, setMaxPageReached] = useState(1);
  const [ready, setReady] = useState(false);
  const maxRef = useRef(1);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setCurrentPage(1);
    setMaxPageReached(1);
    maxRef.current = 1;

    // Wait for the real page count before restoring, so a saved page beyond the
    // document length is clamped against the actual total.
    if (totalPages <= 0 || !resourceId) return;

    void (async () => {
      const saved = await readingRepository.getByResource(chapterId, resourceId);
      if (cancelled) return;
      const wanted =
        typeof requestedPage === "number" && Number.isFinite(requestedPage)
          ? requestedPage
          : (saved?.lastPage ?? 1);
      const page = clampPage(wanted, totalPages);
      const max = clampPage(Math.max(saved?.maxPageReached ?? 1, page), totalPages);
      setCurrentPage(page);
      setMaxPageReached(max);
      maxRef.current = max;
      setReady(true);

      // A deep-linked page becomes the new resume position immediately.
      if (typeof requestedPage === "number" && page !== saved?.lastPage) {
        await readingRepository.updateProgress(chapterId, resourceId, page, totalPages);
        await progressRepository.recalculateChapter(chapterId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chapterId, resourceId, totalPages, requestedPage]);


  const goToPage = useCallback(
    (page: number) => {
      if (!Number.isInteger(page) || page < 1 || page > totalPages) return;
      if (!resourceId) return;
      setCurrentPage(page);
      const nextMax = Math.max(maxRef.current, page);
      maxRef.current = nextMax;
      setMaxPageReached(nextMax);

      void (async () => {
        await readingRepository.updateProgress(
          chapterId,
          resourceId,
          page,
          totalPages,
        );
        await progressRepository.recalculateChapter(chapterId);
      })();
    },
    [chapterId, resourceId, totalPages],
  );

  return {
    currentPage,
    maxPageReached,
    totalPages,
    ready,
    readingRatio: totalPages > 0 ? Math.min(1, maxPageReached / totalPages) : 0,
    goToPage,
    nextPage: () => goToPage(currentPage + 1),
    previousPage: () => goToPage(currentPage - 1),
    canGoPrevious: currentPage > 1,
    canGoNext: currentPage < totalPages,
  };
}
