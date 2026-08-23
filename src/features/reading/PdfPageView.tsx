/**
 * PDF.js canvas renderer (Sprint 3B).
 *
 * Owns document loading, responsive page rendering and render-task
 * cancellation. Reading progress/persistence stays in `useReaderState`.
 */

import { useEffect, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

import { loadPdfJs } from "./pdfjs";

interface PdfPageViewProps {
  pdfUrl?: string | undefined;
  page: number;
  /** 0.75 – 2 */
  zoom: number;
  onDocumentLoaded: (totalPages: number) => void;
}

type DocState =
  | { status: "unavailable" }
  | { status: "loading" }
  | { status: "ready"; doc: PDFDocumentProxy }
  | { status: "error"; message: string };

export function PdfPageView({ pdfUrl, page, zoom, onDocumentLoaded }: PdfPageViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const loadedRef = useRef(onDocumentLoaded);
  loadedRef.current = onDocumentLoaded;

  const [doc, setDoc] = useState<DocState>(() =>
    pdfUrl ? { status: "loading" } : { status: "unavailable" },
  );
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Load the document (browser only).
  useEffect(() => {
    if (!pdfUrl) {
      setDoc({ status: "unavailable" });
      return;
    }
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    setDoc({ status: "loading" });

    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const task = pdfjs.getDocument({ url: pdfUrl });
        loadingTask = task;
        const document = await task.promise;
        if (cancelled) return;
        setDoc({ status: "ready", doc: document });
        loadedRef.current(document.numPages);
      } catch (error) {
        if (cancelled) return;
        setDoc({
          status: "error",
          message: error instanceof Error ? error.message : "Unknown PDF error",
        });
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [pdfUrl]);

  // Track container width so pages fit the reader on mobile.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(Math.round(width));
    });
    observer.observe(el);
    setContainerWidth(Math.round(el.clientWidth));
    return () => observer.disconnect();
  }, [doc.status]);

  // Render the current page.
  useEffect(() => {
    if (doc.status !== "ready" || containerWidth <= 0) return;
    let cancelled = false;
    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    setRendering(true);
    setRenderError(null);

    void (async () => {
      try {
        const pdfPage = await doc.doc.getPage(Math.min(page, doc.doc.numPages));
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        const base = pdfPage.getViewport({ scale: 1 });
        const fitScale = containerWidth / base.width;
        const viewport = pdfPage.getViewport({ scale: fitScale * zoom });
        const dpr = Math.min(window.devicePixelRatio || 1, 3);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const task = pdfPage.render({
          canvasContext: context,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) setRendering(false);
      } catch (error) {
        if (cancelled) return;
        const name = (error as { name?: string })?.name;
        if (name === "RenderingCancelledException") return;
        setRendering(false);
        setRenderError(error instanceof Error ? error.message : "Unable to render this page");
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [doc, page, zoom, containerWidth]);

  if (doc.status === "unavailable") {
    return (
      <section className="mt-4 flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center md:min-h-[38rem]">
        <FileText className="size-6 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium">PDF unavailable</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          No document is linked to this chapter yet.
        </p>
      </section>
    );
  }

  if (doc.status === "error") {
    return (
      <section className="mt-4 flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-destructive/50 p-8 text-center md:min-h-[38rem]">
        <AlertCircle className="size-6 text-destructive" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium">Could not load the PDF</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{doc.message}</p>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className="mt-4 min-h-[24rem] overflow-x-auto rounded-lg border border-border bg-muted/30 p-2 md:min-h-[38rem]"
    >
      {doc.status === "loading" ? (
        <div className="flex min-h-[22rem] flex-col items-center justify-center text-center md:min-h-[36rem]">
          <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
          <p className="mt-3 text-xs text-muted-foreground">Loading PDF…</p>
        </div>
      ) : (
        <div className="relative flex justify-center">
          <canvas ref={canvasRef} className="max-w-full rounded-md bg-background shadow-sm" />
          {rendering ? (
            <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground">
              Rendering page…
            </p>
          ) : null}
          {renderError ? (
            <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-background/90 px-2 py-1 text-xs text-destructive">
              {renderError}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
