/**
 * Strict, defensive validation of an imported backup file.
 *
 * Imported content is treated as inert data: strings only, never HTML, never
 * executed. Prototype-pollution keys are rejected outright.
 */

import {
  ALLOWED_SETTING_KEYS,
  BACKUP_COURSE_ID,
  BACKUP_FORMAT,
  MAX_BACKUP_BYTES,
  MAX_NOTE_BODY_LENGTH,
  MAX_RECORDS_PER_COLLECTION,
  SUPPORTED_FORMAT_VERSIONS,
  type BackupAudioProgress,
  type BackupBookmark,
  type BackupNote,
  type BackupPayloadV1,
  type BackupReadingProgress,
} from "./format";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 8;
const MAX_ID_LENGTH = 200;

export interface ValidationResult {
  ok: boolean;
  error?: string;
  payload?: BackupPayloadV1;
  /** Records dropped because a single field was invalid. */
  skipped: number;
}

const fail = (error: string): ValidationResult => ({ ok: false, error, skipped: 0 });

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function hasForbiddenKeys(value: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some((v) => hasForbiddenKeys(v, depth + 1));
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) return true;
      if (hasForbiddenKeys(value[key], depth + 1)) return true;
    }
  }
  return false;
}

const isId = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= MAX_ID_LENGTH;

const isNonNegative = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

const isTimestamp = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));

/** Parses raw JSON text and validates the whole structure. Never writes data. */
export function validateBackupText(text: string): ValidationResult {
  if (text.length > MAX_BACKUP_BYTES) {
    return fail("This file is too large to be a valid ENCOR Navigator backup.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail("This file is not valid JSON.");
  }

  if (!isPlainObject(parsed)) return fail("This backup file has an unexpected structure.");
  if (hasForbiddenKeys(parsed)) {
    return fail("This backup file contains unsafe keys and was rejected.");
  }

  if (parsed.format !== BACKUP_FORMAT) {
    return fail("This file is not an ENCOR Navigator backup.");
  }
  if (
    typeof parsed.formatVersion !== "number" ||
    !SUPPORTED_FORMAT_VERSIONS.includes(parsed.formatVersion as 1)
  ) {
    return fail("This backup was created by a newer app version and cannot be restored.");
  }
  if (parsed.courseId !== BACKUP_COURSE_ID) {
    return fail("This backup belongs to a different course.");
  }
  if (parsed.exportedAt !== undefined && !isTimestamp(parsed.exportedAt)) {
    return fail("This backup has an invalid export date.");
  }

  const data = parsed.data;
  if (!isPlainObject(data)) return fail("This backup does not contain any learning data.");

  const collections = ["readingProgress", "audioProgress", "notes", "bookmarks"] as const;
  for (const key of collections) {
    const value = data[key];
    if (value !== undefined && !Array.isArray(value)) {
      return fail(`The "${key}" section of this backup is malformed.`);
    }
    if (Array.isArray(value) && value.length > MAX_RECORDS_PER_COLLECTION) {
      return fail("This backup contains an unreasonable number of records.");
    }
  }
  if (data.settings !== undefined && !isPlainObject(data.settings)) {
    return fail("The settings section of this backup is malformed.");
  }

  let skipped = 0;
  const keep = <T>(rows: unknown, check: (row: Record<string, unknown>) => T | null): T[] => {
    if (!Array.isArray(rows)) return [];
    const out: T[] = [];
    for (const row of rows) {
      if (!isPlainObject(row)) {
        skipped += 1;
        continue;
      }
      const mapped = check(row);
      if (mapped === null) skipped += 1;
      else out.push(mapped);
    }
    return out;
  };

  const readingProgress = keep<BackupReadingProgress>(data.readingProgress, (r) => {
    if (!isId(r.chapterId) || !isId(r.pdfResourceId)) return null;
    if (!isNonNegative(r.lastPage) || !isNonNegative(r.maxPageReached)) return null;
    if (!isTimestamp(r.updatedAt)) return null;
    return {
      chapterId: r.chapterId,
      pdfResourceId: r.pdfResourceId,
      lastPage: Math.floor(r.lastPage),
      maxPageReached: Math.floor(r.maxPageReached),
      updatedAt: r.updatedAt,
    };
  });

  const audioProgress = keep<BackupAudioProgress>(data.audioProgress, (r) => {
    if (!isId(r.chapterId) || !isId(r.audioResourceId)) return null;
    if (!isNonNegative(r.currentTime) || !isNonNegative(r.maxPosition)) return null;
    if (r.duration !== undefined && !isNonNegative(r.duration)) return null;
    if (!isTimestamp(r.updatedAt)) return null;
    return {
      chapterId: r.chapterId,
      audioResourceId: r.audioResourceId,
      currentTime: r.currentTime,
      maxPosition: r.maxPosition,
      ...(r.duration !== undefined ? { duration: r.duration as number } : {}),
      updatedAt: r.updatedAt,
    };
  });

  const notes = keep<BackupNote>(data.notes, (r) => {
    if (!isId(r.id) || !isId(r.chapterId) || !isId(r.pdfResourceId)) return null;
    if (!isNonNegative(r.pageNumber) || r.pageNumber < 1) return null;
    if (typeof r.body !== "string" || r.body.trim().length === 0) return null;
    if (r.body.length > MAX_NOTE_BODY_LENGTH) return null;
    if (!isTimestamp(r.updatedAt)) return null;
    return {
      id: r.id,
      chapterId: r.chapterId,
      pdfResourceId: r.pdfResourceId,
      pageNumber: Math.floor(r.pageNumber as number),
      body: r.body,
      createdAt: isTimestamp(r.createdAt) ? r.createdAt : r.updatedAt,
      updatedAt: r.updatedAt,
    };
  });

  const bookmarks = keep<BackupBookmark>(data.bookmarks, (r) => {
    if (!isId(r.id) || !isId(r.chapterId) || !isId(r.pdfResourceId)) return null;
    if (!isNonNegative(r.pageNumber) || r.pageNumber < 1) return null;
    if (!isTimestamp(r.updatedAt)) return null;
    return {
      id: r.id,
      chapterId: r.chapterId,
      pdfResourceId: r.pdfResourceId,
      pageNumber: Math.floor(r.pageNumber as number),
      createdAt: isTimestamp(r.createdAt) ? r.createdAt : r.updatedAt,
      updatedAt: r.updatedAt,
    };
  });

  const settings: Record<string, unknown> = {};
  if (isPlainObject(data.settings)) {
    for (const key of ALLOWED_SETTING_KEYS) {
      const value = (data.settings as Record<string, unknown>)[key];
      if (value === undefined) continue;
      const primitive =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean";
      if (primitive) settings[key] = value;
      else skipped += 1;
    }
  }

  return {
    ok: true,
    skipped,
    payload: {
      format: BACKUP_FORMAT,
      formatVersion: parsed.formatVersion,
      appVersion: typeof parsed.appVersion === "string" ? parsed.appVersion : "unknown",
      courseId: BACKUP_COURSE_ID,
      exportedAt: isTimestamp(parsed.exportedAt) ? parsed.exportedAt : new Date().toISOString(),
      data: { readingProgress, audioProgress, notes, bookmarks, settings },
    },
  };
}
