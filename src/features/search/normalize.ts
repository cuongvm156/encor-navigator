/**
 * Query / text normalization for offline global search (Sprint 5B).
 *
 * Everything runs locally in the browser — no query ever leaves the device.
 * Rules: Unicode NFD normalization, accent folding (Vietnamese included),
 * lowercase, whitespace collapse, punctuation-only tokens dropped, and
 * letter/digit boundary splitting so `ch14` matches `chapter 14`.
 */

/** Lowercased, accent-free, whitespace-collapsed form used for matching only. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, (m) => (m === "Đ" ? "D" : "d"))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits a folded string into meaningful tokens. Punctuation is discarded and
 * letter/digit runs are separated (`ch14` -> `ch`, `14`).
 */
export function tokenize(value: string): string[] {
  const folded = foldText(value);
  const tokens: string[] = [];
  for (const chunk of folded.split(/[^a-z0-9]+/)) {
    if (!chunk) continue;
    const parts = chunk.match(/[a-z]+|[0-9]+/g);
    if (parts) tokens.push(...parts);
  }
  return tokens;
}

/** Number of characters in the query that actually matter. */
export function meaningfulLength(query: string): number {
  return tokenize(query).join("").length;
}

/**
 * A query is searchable from 1 character when it is numeric (chapter number),
 * otherwise from 2 characters.
 */
export function isSearchable(query: string): boolean {
  const tokens = tokenize(query);
  if (tokens.length === 0) return false;
  if (tokens.some((t) => /^[0-9]+$/.test(t))) return true;
  return tokens.join("").length >= 2;
}

/** Strips leading zeros so `ch01` and `ch1` behave identically. */
export const stripLeadingZeros = (token: string) =>
  /^[0-9]+$/.test(token) ? String(Number(token)) : token;
