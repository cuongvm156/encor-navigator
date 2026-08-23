/**
 * Offline structural validation of the centralized resource manifest.
 * Run with: npm run validate:resources
 */
import {
  MANIFEST_CHAPTER_IDS,
  getAvailableAudioCount,
  getAvailablePdfCount,
  getTestingResourceCount,
  validateResourceManifest,
} from "../src/data/resourceManifest.ts";

const errors = validateResourceManifest(MANIFEST_CHAPTER_IDS);

if (errors.length > 0) {
  console.error("Resource manifest is invalid:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `Resource manifest OK — ${MANIFEST_CHAPTER_IDS.length} chapters, ` +
    `${getAvailablePdfCount()} active PDF(s), ${getAvailableAudioCount()} active audio, ` +
    `${getTestingResourceCount()} testing resource(s).`,
);
