/**
 * Live offline search — reads the existing repositories through Dexie
 * liveQuery, so notes, bookmarks, progress and offline availability changes
 * appear immediately with no reload and no extra index table.
 */

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { chapters, parts } from "@/features/course/data";
import { useOfflineResources } from "@/features/offline/useOfflineResources";
import {
  bookmarksRepository,
  readerNotesRepository,
} from "@/repositories/readerAnnotationsRepository";

import { runSearch, type SearchFilters, type SearchGroups } from "./searchCore";

export interface LiveSearch {
  groups: SearchGroups;
  /** True while the Dexie sources are still initializing. */
  loading: boolean;
  error?: string;
}

export function useSearchResults(query: string, filters: SearchFilters): LiveSearch {
  const notes = useLiveQuery(() => readerNotesRepository.getAll(), [], undefined);
  const bookmarks = useLiveQuery(() => bookmarksRepository.getAll(), [], undefined);
  const offlineRows = useOfflineResources();

  const offlineChapterIds = useMemo(
    () =>
      new Set(offlineRows.filter((row) => row.status === "ready").map((row) => row.chapterId)),
    [offlineRows],
  );

  const loading = notes === undefined || bookmarks === undefined;

  return useMemo(() => {
    try {
      const groups = runSearch(
        query,
        {
          parts,
          chapters,
          notes: notes ?? [],
          bookmarks: bookmarks ?? [],
          offlineChapterIds,
        },
        filters,
      );
      return { groups, loading };
    } catch (error) {
      console.error("[search] failed", error);
      return {
        groups: { parts: [], chapters: [], notes: [], bookmarks: [], total: 0 },
        loading: false,
        error: "Search could not be completed on this device. Try a different query.",
      };
    }
  }, [query, notes, bookmarks, offlineChapterIds, filters, loading]);
}
