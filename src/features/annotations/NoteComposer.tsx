/**
 * Mobile-friendly bottom sheet for creating or editing a reader note.
 * Rendering the sheet never touches the PDF canvas.
 */

import { useEffect, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

interface NoteComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterTitle: string;
  pageNumber: number;
  initialBody?: string;
  mode?: "create" | "edit";
  onSave: (body: string) => Promise<void> | void;
}

export function NoteComposer({
  open,
  onOpenChange,
  chapterTitle,
  pageNumber,
  initialBody = "",
  mode = "create",
  onSave,
}: NoteComposerProps) {
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setBody(initialBody);
  }, [open, initialBody]);

  const valid = body.trim().length > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave(body.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Edit note" : "Add note"}</SheetTitle>
          <SheetDescription>
            {chapterTitle} · PDF page {pageNumber}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            placeholder="Write your note…"
            aria-label="Note text"
            className="min-h-32"
          />
          {!valid ? (
            <p className="mt-2 text-xs text-muted-foreground">Note text is required.</p>
          ) : null}
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm transition-colors hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!valid || saving}
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            Save
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
