/**
 * Settings → Backup & Restore (Sprint 5A).
 *
 * Export produces a local JSON file (share sheet on iPhone, download elsewhere).
 * Restore validates the file, shows a preview and merges inside one Dexie
 * transaction. Existing data is never cleared or replaced.
 */

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { NO_MEDIA_NOTICE, type BackupPayloadV1, MAX_BACKUP_BYTES } from "./format";
import { exportBackup } from "./exportBackup";
import { previewRestore, restoreBackup, type RestorePreview, type RestoreResult } from "./restore";
import { useBackupStats } from "./useBackupStats";
import { validateBackupText } from "./validate";

const formatDate = (iso?: string) => {
  if (!iso) return "Never";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="shrink-0 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function BackupRestoreSection() {
  const stats = useBackupStats();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<
    { payload: BackupPayloadV1; preview: RestorePreview; fileName: string; skipped: number } | null
  >(null);
  const [result, setResult] = useState<RestoreResult | null>(null);

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { method, fileName } = await exportBackup();
      setMessage(
        method === "share"
          ? `Backup shared as ${fileName}. Choose "Save to Files" to keep it.`
          : `Backup downloaded as ${fileName}.`,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") setMessage("Export cancelled.");
      else setError("The backup could not be created. Your data was not changed.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setResult(null);
    setPending(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) {
        setError("This file is too large to be a valid ENCOR Navigator backup.");
        return;
      }
      const text = await file.text();
      const validation = validateBackupText(text);
      if (!validation.ok || !validation.payload) {
        setError(validation.error ?? "This backup file could not be read.");
        return;
      }
      const preview = await previewRestore(validation.payload, validation.skipped);
      setPending({
        payload: validation.payload,
        preview,
        fileName: file.name,
        skipped: validation.skipped,
      });
    } catch {
      setError("This file could not be read. No data was changed.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRestore = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await restoreBackup(pending.payload, {
        fileName: pending.fileName,
        skipped: pending.skipped,
      });
      setResult(outcome);
      setPending(null);
      setMessage("Restore complete. Your existing data was merged, not replaced.");
    } catch {
      setError("The restore failed and was rolled back. Your existing data is unchanged.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-tight">Backup &amp; Restore</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Export your progress, notes and bookmarks as a JSON file, or merge a backup from another
        device. Downloaded PDFs and audio are never included.
      </p>

      <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
        <Row label="Last backup on this device" value={formatDate(stats.lastBackupAt)} />
        <Row label="Reading progress records" value={String(stats.readingCount)} />
        <Row label="Audio progress records" value={String(stats.audioCount)} />
        <Row label="Notes" value={String(stats.noteCount)} />
        <Row label="Bookmarks" value={String(stats.bookmarkCount)} />
        {stats.lastRestoreAt ? (
          <Row label="Last restore" value={formatDate(stats.lastRestoreAt)} />
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={handleExport} disabled={busy} className="min-h-11">
          Export backup
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          Restore from backup
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message && !pending ? (
        <p className="mt-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">{message}</p>
      ) : null}

      {pending ? (
        <div className="mt-4 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Restore preview</h3>
          <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
            <Row label="Backup date" value={formatDate(pending.preview.exportedAt)} />
            <Row label="Course" value={pending.preview.courseId} />
            <Row label="Reading records" value={String(pending.preview.readingCount)} />
            <Row label="Audio records" value={String(pending.preview.audioCount)} />
            <Row label="Notes" value={String(pending.preview.noteCount)} />
            <Row label="Bookmarks" value={String(pending.preview.bookmarkCount)} />
            <Row label="Settings" value={String(pending.preview.settingCount)} />
            <Row label="New records" value={String(pending.preview.newRecords)} />
            <Row label="Existing records merged" value={String(pending.preview.mergedRecords)} />
            <Row label="Records skipped" value={String(pending.preview.skipped)} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Conflicts are resolved using the newer update time; progress values are never reduced.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{NO_MEDIA_NOTICE}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleRestore} disabled={busy} className="min-h-11">
              Restore and merge
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {result ? (
        <dl className="mt-4 divide-y divide-border rounded-lg border border-border">
          <Row label="Records added" value={String(result.added)} />
          <Row label="Records updated" value={String(result.updated)} />
          <Row label="Records unchanged" value={String(result.unchanged)} />
          <Row label="Records rejected or skipped" value={String(result.skipped)} />
        </dl>
      ) : null}
    </section>
  );
}
