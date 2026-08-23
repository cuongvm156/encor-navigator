/**
 * DEVELOPMENT / SMOKE-TEST ONLY.
 *
 * The demo audio constants now live in the centralized resource manifest
 * (`src/data/resourceManifest.ts`) and are re-exported here for existing
 * callers. No copyrighted Cisco Press audio may be referenced, and no MP3
 * binaries are committed.
 */
export { DEMO_AUDIO_URL, DEMO_RESOURCE_ID } from "@/data/resourceManifest";

/** Public test asset used for audible verification. */
export const DEMO_AUDIO_TITLE = "Demo audio (development smoke test)";
