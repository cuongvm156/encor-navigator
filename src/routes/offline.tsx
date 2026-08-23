import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Download, FileUp, Headphones, RefreshCw, Trash2, Video, X } from "lucide-react";

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
import {
  getAudioResource,
  getMediaTracks,
  getPdfResource,
  getResourceById,
} from "@/data/resourceManifest";
import type { OfflineResourceKind, OfflineResourceRecord } from "@/db/schema";
import { cacheStorageSupported, formatBytes } from "@/features/offline/cache";
import { cancelDownload, startDownload } from "@/features/offline/downloads";
import { importLocalFile } from "@/features/offline/localImport";
import { offlineResourcesRepository } from "@/repositories/offlineResourcesRepository";
import { resolveChapterTracks, type MediaMode } from "@/features/media/tracks";
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
          "Download or import chapter PDFs and per-track audio or video for offline study. Files stay on this device only.",
      },
      { property: "og:title", content: "Offline resources — ENCOR Study" },
      {
        property: "og:description",
        content: "Manage offline chapter PDFs and per-track media stored on this device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfflinePage,
});

const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50";

const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50";

const ACCEPT: Record<OfflineResourceKind, string> = {
  pdf: "application/pdf,.pdf",
  audio: "audio/*,.mp3,.m4a,.aac,.wav,.ogg",
  video: "video/*,.mp4,.m4v,.mov,.webm",
};

const KIND_LABEL: Record<OfflineResourceKind, string> = {
  pdf: "PDF",
  audio: "Audio",
  video: "Video",
};

interface RemovalTarget {
  record: OfflineResourceRecord;
  label: string;
}

interface PendingImport {
  chapterId: string;
  kind: OfflineResourceKind;
  trackId?: string;
  targetResourceId?: string;
  replacesResourceId?: string;
}

function OfflinePage() {
  useOfflineReconciliation();
  const rows = useOfflineResources();
  const active = useActiveDownloads();
  const { estimate, supported: estimateSupported } = useStorageEstimate();
  const [removal, setRemoval] = useState<RemovalTarget | undefined>(undefined);
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingImport = useRef<PendingImport | undefined>(undefined);

  const storageSupported = cacheStorageSupported();

  const storedBytes = useMemo(
    () => rows.reduce((total, row) => total + (row.sizeBytes ?? 0), 0),
    [rows],
  );
  const readyCount = rows.filter((row) => row.status === "ready").length;

  const handleDownload = async (input: {
    chapterId: string;
    kind: OfflineResourceKind;
    resourceId: string;
    url: string;
    fileName?: string;
    trackId?: string;
  }) => {
    try {
      await startDownload({
        chapterId: input.chapterId,
        kind: input.kind,
        resourceId: input.resourceId,
        url: input.url,
        ...(input.trackId ? { trackId: input.trackId } : {}),
        ...(input.fileName ? { fileName: input.fileName } : {}),
      });
      toast.success(`${KIND_LABEL[input.kind]} saved for offline use`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    }
  };

  const openImport = (target: PendingImport) => {
    pendingImport.current = target;
    const input = inputRef.current;
    if (!input) return;
    input.accept = ACCEPT[target.kind];
    input.value = "";
    input.click();
  };

  const handleFileSelected = async (file: File | undefined) => {
    const target = pendingImport.current;
    pendingImport.current = undefined;
    if (!file || !target) return;
    setBusy(`${target.chapterId}:${target.trackId ?? "chapter"}:${target.kind}`);
    try {
      await importLocalFile({
        chapterId: target.chapterId,
        kind: target.kind,
        file,
        ...(target.trackId ? { trackId: target.trackId } : {}),
        ...(target.targetResourceId ? { targetResourceId: target.targetResourceId } : {}),
        ...(target.replacesResourceId ? { replacesResourceId: target.replacesResourceId } : {}),
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

  /** One row of the list: a PDF, or one rendition of one MediaTrack. */
  const ResourceRow = ({
    title,
    subtitleLabel,
    kind,
    chapterId,
    trackId,
    manifest,
    stored,
    open,
  }: {
    title: string;
    subtitleLabel: string;
    kind: OfflineResourceKind;
    chapterId: string;
    trackId?: string;
    manifest?: { resourceId: string; url?: string; fileName?: string } | undefined;
    stored?: OfflineResourceRecord | undefined;
    open?: React.ReactNode;
  }) => {
    const progress = manifest ? active[manifest.resourceId] : undefined;
    const downloading = Boolean(progress);
    const importing = busy === `${chapterId}:${trackId ?? "chapter"}:${kind}`;
    const localStored = stored?.sourceType === "local-import" ? stored : undefined;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
        <div className="min-w-0">
          <p className="text-sm">{title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {stored?.status === "ready"
              ? `${stored.sourceType === "local-import" ? "Imported" : "Downloaded"} · ${
                  stored.originalFileName ?? stored.resourceId
                } · ${formatBytes(stored.sizeBytes)}`
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
                    : subtitleLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {stored?.status === "ready" ? open : null}

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
                void handleDownload({
                  chapterId,
                  kind,
                  resourceId: manifest.resourceId,
                  url: manifest.url!,
                  ...(manifest.fileName ? { fileName: manifest.fileName } : {}),
                  ...(trackId ? { trackId } : {}),
                })
              }
            >
              {stored?.status === "error" ? (
                <RefreshCw className="size-4" strokeWidth={1.75} />
              ) : (
                <Download className="size-4" strokeWidth={1.75} />
              )}
              {stored?.status === "error" ? "Retry" : "Download"}
            </button>
          ) : null}

          <button
            type="button"
            className={buttonClass}
            disabled={!storageSupported || importing}
            onClick={() =>
              openImport({
                chapterId,
                kind,
                ...(trackId ? { trackId } : {}),
                ...(manifest?.resourceId ? { targetResourceId: manifest.resourceId } : {}),
                ...(localStored ? { replacesResourceId: localStored.resourceId } : {}),
              })
            }
          >
            <FileUp className="size-4" strokeWidth={1.75} />
            {importing ? "Importing…" : localStored ? "Replace file" : "Import file"}
          </button>

          {stored ? (
            <button
              type="button"
              className={buttonClass}
              aria-label={`Remove offline ${kind} for ${title}`}
              onClick={() => setRemoval({ record: stored, label: title })}
            >
              <Trash2 className="size-4" strokeWidth={1.75} />
              Remove
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Offline"
        title="Offline resources"
        description="Download manifest files or import your own copies per chapter document and per media track. Everything stays on this device."
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
            const pdfManifest = getPdfResource(chapter.id);
            const pdfLocal = pickOffline(rows, chapter.id, "pdf", "local-import");
            const pdfDownloaded = pdfManifest
              ? rows.find((row) => row.resourceId === pdfManifest.resourceId)
              : undefined;

            const declaredTracks = getMediaTracks(chapter.id);
            const resolvedTracks = resolveChapterTracks(rows, chapter.id);

            return (
              <li key={chapter.id} className="rounded-lg border border-border p-4">
                <p className="truncate text-sm font-medium">{chapterLabel}</p>
                <div className="mt-3 space-y-3">
                  <ResourceRow
                    title="PDF"
                    subtitleLabel="No file published yet"
                    kind="pdf"
                    chapterId={chapter.id}
                    manifest={pdfManifest}
                    stored={pdfLocal ?? pdfDownloaded}
                    open={
                      <Link
                        to="/reader/$chapterId"
                        params={{ chapterId: chapter.id }}
                        className={primaryButtonClass}
                        aria-label={`Open offline PDF for chapter ${chapter.number}`}
                      >
                        <BookOpen className="size-4" strokeWidth={1.75} />
                        Open PDF
                      </Link>
                    }
                  />

                  {declaredTracks.length === 0 ? (
                    // Legacy chapters with no declared MediaTrack keep exactly
                    // the previous chapter-level audio row.
                    <ResourceRow
                      title="Audio"
                      subtitleLabel="No file published yet"
                      kind="audio"
                      chapterId={chapter.id}
                      manifest={getAudioResource(chapter.id)}
                      stored={
                        pickOffline(rows, chapter.id, "audio", "local-import") ??
                        rows.find(
                          (row) =>
                            row.chapterId === chapter.id &&
                            row.kind === "audio" &&
                            row.sourceType === "download",
                        )
                      }
                      open={
                        <Link
                          to="/audio"
                          search={{ chapter: chapter.id }}
                          className={primaryButtonClass}
                          aria-label={`Open offline audio for chapter ${chapter.number}`}
                        >
                          <Headphones className="size-4" strokeWidth={1.75} />
                          Open Audio
                        </Link>
                      }
                    />
                  ) : (
                    resolvedTracks.map((entry, order) =>
                      (["audio", "video"] as MediaMode[]).map((mode) => {
                        const rendition = mode === "audio" ? entry.audio : entry.video;
                        const manifestId =
                          mode === "audio"
                            ? entry.track.audioResourceId
                            : entry.track.videoResourceId;
                        const manifestRow = getResourceById(manifestId);
                        const manifest =
                          manifestRow &&
                          (manifestRow.status === "available" || manifestRow.status === "testing")
                            ? manifestRow
                            : undefined;
                        const stored =
                          rendition.record ??
                          (manifestId
                            ? rows.find((row) => row.resourceId === manifestId)
                            : undefined);
                        if (!manifestId && !stored) {
                          // The track does not declare this rendition at all —
                          // an import still targets it explicitly.
                        }
                        return (
                          <ResourceRow
                            key={`${entry.track.trackId}:${mode}`}
                            title={`Track ${order + 1} · ${entry.track.title} · ${KIND_LABEL[mode]}`}
                            subtitleLabel={
                              manifestId
                                ? "No file published yet — import your own copy"
                                : "This track declares no published file — import your own copy"
                            }
                            kind={mode}
                            chapterId={chapter.id}
                            trackId={entry.track.trackId}
                            manifest={manifest}
                            stored={stored}
                            open={
                              mode === "audio" ? (
                                <Link
                                  to="/audio"
                                  search={{ chapter: chapter.id, track: entry.track.trackId }}
                                  className={primaryButtonClass}
                                  aria-label={`Open offline audio for ${entry.track.title}`}
                                >
                                  <Headphones className="size-4" strokeWidth={1.75} />
                                  Open Audio
                                </Link>
                              ) : (
                                <Link
                                  to="/video"
                                  search={{ chapter: chapter.id, track: entry.track.trackId }}
                                  className={primaryButtonClass}
                                  aria-label={`Open offline video for ${entry.track.title}`}
                                >
                                  <Video className="size-4" strokeWidth={1.75} />
                                  Open Video
                                </Link>
                              )
                            }
                          />
                        );
                      }),
                    )
                  )}
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
              This deletes only the offline copy of {removal?.label}. Other tracks, the paired
              rendition, your reading progress, playback position, notes and bookmarks stay
              untouched.
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
