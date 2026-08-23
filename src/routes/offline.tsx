import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileUp, Trash2, X } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { chapters } from "@/features/course/data";
import { getAudioResource, getPdfResource } from "@/data/resourceManifest";
import type { OfflineResourceKind, OfflineResourceRecord } from "@/db/schema";
import { cacheStorageSupported, formatBytes } from "@/features/offline/cache";
import { cancelDownload, startDownload } from "@/features/offline/downloads";
import { importLocalFile } from "@/features/offline/localImport";
import { offlineResourcesRepository } from "@/repositories/offlineResourcesRepository";
import {
  pickOffline,
  useActiveDownloads,
  useOfflineReconciliation,
  useOfflineResources,
  useStorageEstimate,
} from "@/features/offline/useOfflineResources";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "Offline resources — ENCOR Study" },
      {
        name: "description",
        content:
          "Download or import chapter PDFs and audio for offline study. Files stay on this device only.",
      },
      { property: "og:title", content: "Offline resources — ENCOR Study" },
      {
        property: "og:description",
        content: "Manage offline chapter PDFs and audio stored on this device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfflinePage,
});

const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50";

const ACCEPT: Record<OfflineResourceKind, string> = {
  pdf: "application/pdf,.pdf",
  audio: "audio/*,.mp3,.m4a,.aac,.wav,.ogg",
};

interface RemovalTarget {
  record: OfflineResourceRecord;
  chapterLabel: string;
}

function OfflinePage() {
  useOfflineReconciliation();
  const rows = useOfflineResources();
  const active = useActiveDownloads();
  const { estimate, supported: estimateSupported } = useStorageEstimate();
  const [removal, setRemoval] = useState<RemovalTarget | undefined>(undefined);
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingImport = useRef<{ chapterId: string; kind: OfflineResourceKind } | undefined>(
    undefined,
  );

  const storageSupported = cacheStorageSupported();

  const storedBytes = useMemo(
    () => rows.reduce((total, row) => total + (row.sizeBytes ?? 0), 0),
    [rows],
  );
  const readyCount = rows.filter((row) => row.status === "ready").length;

  const handleDownload = async (
    chapterId: string,
    kind: OfflineResourceKind,
    resourceId: string,
    url: string,
    fileName?: string,
  ) => {
    try {
      await startDownload({
        chapterId,
        kind,
        resourceId,
        url,
        ...(fileName ? { fileName } : {}),
      });
      toast.success(`${kind === "pdf" ? "PDF" : "Audio"} saved for offline use`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    }
  };

  const openImport = (chapterId: string, kind: OfflineResourceKind) => {
    pendingImport.current = { chapterId, kind };
    const input = inputRef.current;
    if (!input) return;
    input.accept = ACCEPT[kind];
    input.value = "";
    input.click();
  };

  const handleFileSelected = async (file: File | undefined) => {
    const target = pendingImport.current;
    pendingImport.current = undefined;
    if (!file || !target) return;
    const existingLocal = pickOffline(rows, target.chapterId, target.kind, "local-import");
    setBusy(`${target.chapterId}:${target.kind}`);
    try {
      await importLocalFile({
        chapterId: target.chapterId,
        kind: target.kind,
        file,
        ...(existingLocal ? { replacesResourceId: existingLocal.resourceId } : {}),
      });
      toast.success(`${file.name} imported for offline use`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(undefined);
    }
  };

  const confirmRemoval = async () => {
    const target = removal;
    setRemoval(undefined);
    if (!target) return;
    await offlineResourcesRepository.remove(target.record.resourceId);
    toast.success("Offline file removed — your progress, notes and bookmarks are kept.");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Offline"
        title="Offline resources"
        description="Download manifest files or import your own copies. Everything stays on this device."
      />

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(event) => void handleFileSelected(event.target.files?.[0])}
        aria-hidden="true"
        tabIndex={-1}
      />

      <section className="rounded-lg border border-border p-4 text-sm">
        <h2 className="text-sm font-semibold tracking-tight">Storage on this device</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Offline files stored</dt>
            <dd className="tabular-nums font-medium">{readyCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Size of offline files</dt>
            <dd className="tabular-nums font-medium">
              {storedBytes > 0 ? formatBytes(storedBytes) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Browser storage used</dt>
            <dd className="tabular-nums font-medium">
              {estimateSupported && estimate?.usage !== undefined
                ? `${formatBytes(estimate.usage)}${
                    estimate.quota ? ` of ${formatBytes(estimate.quota)}` : ""
                  }`
                : "Not reported by this browser"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Files you download or import are stored only in this browser on this device. Nothing is
          uploaded, shared or committed to the project repository.
        </p>
        {!storageSupported ? (
          <p className="mt-2 text-xs text-destructive">
            This browser does not support offline storage, so downloads and imports are disabled.
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Chapters</h2>
        <ul className="mt-3 space-y-3">
          {chapters.map((chapter) => {
            const chapterLabel = `${chapter.number}. ${chapter.title}`;
            const kinds: OfflineResourceKind[] = ["pdf", "audio"];
            return (
              <li key={chapter.id} className="rounded-lg border border-border p-4">
                <p className="truncate text-sm font-medium">{chapterLabel}</p>
                <div className="mt-3 space-y-3">
                  {kinds.map((kind) => {
                    const manifest =
                      kind === "pdf" ? getPdfResource(chapter.id) : getAudioResource(chapter.id);
                    const local = pickOffline(rows, chapter.id, kind, "local-import");
                    const downloaded = manifest
                      ? rows.find((row) => row.resourceId === manifest.resourceId)
                      : undefined;
                    const stored = local ?? downloaded;
                    const progress = manifest ? active[manifest.resourceId] : undefined;
                    const downloading = Boolean(progress);
                    const importing = busy === `${chapter.id}:${kind}`;

                    return (
                      <div
                        key={kind}
                        className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 first:border-0 first:pt-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm">{kind === "pdf" ? "PDF" : "Audio"}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {stored?.status === "ready"
                              ? `${
                                  stored.sourceType === "local-import"
                                    ? "Imported"
                                    : "Downloaded"
                                } · ${stored.originalFileName ?? stored.resourceId} · ${formatBytes(
                                  stored.sizeBytes,
                                )}`
                              : stored?.status === "error"
                                ? (stored.errorMessage ?? "Offline copy unavailable")
                                : downloading
                                  ? progress?.totalBytes
                                    ? `Downloading… ${Math.round(
                                        (progress.receivedBytes / progress.totalBytes) * 100,
                                      )}%`
                                    : `Downloading… ${formatBytes(progress?.receivedBytes)}`
                                  : manifest?.url
                                    ? "Available online — not stored offline"
                                    : "No file published yet"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {downloading ? (
                            <button
                              type="button"
                              className={buttonClass}
                              onClick={() => cancelDownload(manifest!.resourceId)}
                            >
                              <X className="size-4" strokeWidth={1.75} />
                              Cancel
                            </button>
                          ) : manifest?.url && stored?.status !== "ready" ? (
                            <button
                              type="button"
                              className={buttonClass}
                              disabled={!storageSupported}
                              onClick={() =>
                                void handleDownload(
                                  chapter.id,
                                  kind,
                                  manifest.resourceId,
                                  manifest.url!,
                                  manifest.fileName,
                                )
                              }
                            >
                              <Download className="size-4" strokeWidth={1.75} />
                              Download
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className={buttonClass}
                            disabled={!storageSupported || importing}
                            onClick={() => openImport(chapter.id, kind)}
                          >
                            <FileUp className="size-4" strokeWidth={1.75} />
                            {importing ? "Importing…" : local ? "Replace file" : "Import file"}
                          </button>

                          {stored ? (
                            <button
                              type="button"
                              className={buttonClass}
                              aria-label={`Remove offline ${kind} for ${chapterLabel}`}
                              onClick={() => setRemoval({ record: stored, chapterLabel })}
                            >
                              <Trash2 className="size-4" strokeWidth={1.75} />
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <AlertDialog open={Boolean(removal)} onOpenChange={(open) => !open && setRemoval(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove offline file?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes only the offline copy of the {removal?.record.kind === "pdf" ? "PDF" : "audio"}{" "}
              for {removal?.chapterLabel}. Your reading progress, playback position, notes and
              bookmarks stay untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRemoval()}>Remove file</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
