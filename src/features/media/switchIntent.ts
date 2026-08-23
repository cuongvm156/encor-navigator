/**
 * Sprint 6A.1 fix — transient, one-shot rendition-switch intent.
 *
 * Playback must NEVER start because of a URL. A bookmarked, copied, refreshed
 * or Back/Forward-restored address carries no intent, so the target rendition
 * always opens paused. The only way to arm an intent is the user pressing
 * "Watch video instead" / "Switch to audio" while the source rendition is
 * actually playing.
 *
 * The intent lives in module memory only (never in the URL, never persisted),
 * is scoped to an exact chapterId + trackId + target mode, expires quickly, and
 * can be consumed exactly once.
 */

export type RenditionMode = "audio" | "video";

export interface SwitchIntent {
  chapterId: string;
  trackId: string;
  /** Rendition the user is switching TO. */
  mode: RenditionMode;
  createdAt: number;
}

/**
 * A switch intent is only valid for the client-side navigation it triggered.
 * Anything slower than this is treated as a stale intent and ignored.
 */
export const SWITCH_INTENT_TTL_MS = 15_000;

let pending: SwitchIntent | undefined;

/** Arms the one-shot intent. Called ONLY by a user switch action. */
export function requestRenditionSwitch(
  intent: Omit<SwitchIntent, "createdAt">,
  now: number = Date.now(),
): SwitchIntent {
  pending = { ...intent, createdAt: now };
  return pending;
}

/** Read-only look at the armed intent (used by tests and diagnostics). */
export function peekRenditionSwitch(now: number = Date.now()): SwitchIntent | undefined {
  if (!pending) return undefined;
  if (now - pending.createdAt > SWITCH_INTENT_TTL_MS) {
    pending = undefined;
    return undefined;
  }
  return pending;
}

/** Drops any armed intent (e.g. the user navigated somewhere else). */
export function clearRenditionSwitch(): void {
  pending = undefined;
}

/**
 * Consumes the intent when — and only when — it matches this exact track and
 * target mode. Returns true at most once per armed intent.
 */
export function consumeRenditionSwitch(
  chapterId: string | undefined,
  trackId: string | undefined,
  mode: RenditionMode,
  now: number = Date.now(),
): boolean {
  const intent = peekRenditionSwitch(now);
  if (!intent || !chapterId || !trackId) return false;
  if (intent.chapterId !== chapterId || intent.trackId !== trackId || intent.mode !== mode) {
    return false;
  }
  pending = undefined;
  return true;
}
