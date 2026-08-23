/**
 * DEVELOPMENT / SMOKE-TEST ONLY — Sprint 2B.1.
 *
 * THE single canonical demo audio URL for the whole application. Desktop and
 * mobile builds must resolve to this exact file, so it is hardcoded here and
 * NOT overridable via environment variables (an env override made desktop and
 * the iPhone preview play different files).
 *
 * TODO(Sprint 2C+): remove this fallback once real ENCOR audio resources are
 * configured in the course data. No copyrighted Cisco Press audio may ever be
 * referenced here, and no MP3 binaries are committed.
 */
export const DEMO_AUDIO_URL =
  "https://res.cloudinary.com/wvlih3ec/video/upload/v1787110709/0E_001_Audio.mp3";

/** Public test asset used for audible verification. */
export const DEMO_AUDIO_TITLE = "Demo audio (development smoke test)";
