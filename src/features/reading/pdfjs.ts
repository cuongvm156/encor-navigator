/**
 * Browser-only PDF.js loader (Sprint 3B).
 *
 * pdfjs-dist touches DOM/worker APIs at import time, so it is imported lazily
 * and never during SSR. The worker is resolved through Vite's `?url` import so
 * it is bundled and served from the same origin.
 */

import type * as PdfJs from "pdfjs-dist";

let pdfjsPromise: Promise<typeof PdfJs> | undefined;

export function loadPdfJs(): Promise<typeof PdfJs> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDF.js is browser-only"));
  }
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, workerUrl] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = (workerUrl as { default: string }).default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}
