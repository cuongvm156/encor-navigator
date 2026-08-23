/**
 * Derived helpers for course content.
 *
 * Page counts and audio durations are NOT derived here any more: real values
 * come from the PDF document (PDF.js) and from the audio element / persisted
 * playback state. Nothing is estimated from study minutes.
 */

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}
