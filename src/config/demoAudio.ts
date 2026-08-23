/**
 * DEVELOPMENT / SMOKE-TEST ONLY — Sprint 2B.1.
 *
 * A single public, royalty-free test MP3 used so the audio engine can be
 * exercised on any device (including the mobile preview build, which does not
 * receive the local `.env.local` value of `VITE_DEMO_AUDIO_URL`).
 *
 * TODO(Sprint 2C+): remove or disable this fallback once real ENCOR audio
 * resources are configured in the course data. No copyrighted Cisco Press
 * audio may ever be referenced here, and no MP3 binaries are committed.
 */
export const DEMO_AUDIO_URL =
  "https://cdn.jsdelivr.net/gh/anars/blank-audio/2-minutes-of-silence.mp3";

/** Public royalty-free spoken/test asset used for audible verification. */
export const DEMO_AUDIO_TITLE = "Demo audio (development smoke test)";
