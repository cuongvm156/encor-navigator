/**
 * Sprint 5B regression tests for the offline search core.
 * Pure logic only — run with: npm run test:search
 */

import { chapters, parts } from "../src/features/course/data.ts";
import { DEFAULT_FILTERS, runSearch, matchRanges } from "../src/features/search/searchCore.ts";
import { isSearchable } from "../src/features/search/normalize.ts";

const iso = "2026-08-01T10:00:00.000Z";
const notes = [
  {
    id: "n1",
    chapterId: "ch-01",
    pdfResourceId: "test-clcor-ch01-v1",
    pageNumber: 12,
    body: "Packet forwarding recap — tự động hóa của CEF",
    createdAt: iso,
    updatedAt: iso,
  },
];
const bookmarks = [
  {
    id: "b1",
    chapterId: "ch-01",
    pdfResourceId: "test-clcor-ch01-v1",
    pageNumber: 12,
    createdAt: iso,
    updatedAt: iso,
  },
];

const sources = { parts, chapters, notes, bookmarks };
const search = (q: string) => runSearch(q, sources, DEFAULT_FILTERS);

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name} ${detail}`);
  }
}

check("catalogue scope: 9 parts", parts.length === 9, `got ${parts.length}`);
check("catalogue scope: 29 chapters", chapters.length === 29, `got ${chapters.length}`);
check("no chapter 30/31", chapters.every((c) => c.number <= 29));

const ospf = search("ospf").chapters.map((r) => r.chapter.number);
check("'ospf' finds chapters 8 and 9", ospf.includes(8) && ospf.includes(9), JSON.stringify(ospf));

const advanced = search("advanced ospf").chapters.map((r) => r.chapter.number);
check("'advanced ospf' ranks chapter 9 first", advanced[0] === 9, JSON.stringify(advanced));

const ch14 = search("chapter 14").chapters;
check("'chapter 14' finds QoS", ch14[0]?.chapter.title.includes("Quality of Service") === true);
check("'ch 14 qos' finds QoS", search("ch 14 qos").chapters[0]?.chapter.id === "ch-14");
check("'ch01' finds chapter 1", search("ch01").chapters[0]?.chapter.id === "ch-01");
check("'chapter 27' finds Virtualization", search("chapter 27").chapters[0]?.chapter.title === "Virtualization");

const pageQuery = search("packet page 12");
check("'packet page 12' finds the note", pageQuery.notes.length === 1);
check("'page 12' finds the bookmark", search("page 12").bookmarks.length === 1);
check("accent-insensitive note match", search("tu dong hoa").notes.length === 1);
check("no results query is empty", search("zzzzqqq").total === 0);

check("chapter filter by part", runSearch("ospf", sources, { ...DEFAULT_FILTERS, partId: "part-3" }).chapters.length >= 2);
check(
  "type filter notes only",
  runSearch("packet", sources, { ...DEFAULT_FILTERS, type: "note" }).chapters.length === 0,
);
check(
  "pdf availability filter",
  runSearch("packet", sources, { ...DEFAULT_FILTERS, availability: "pdf" }).chapters.every(
    (r) => Boolean(r.chapter.pdfUrl),
  ),
);

check("minimum query length: 'o' not searchable", !isSearchable("o"));
check("minimum query length: '1' searchable", isSearchable("1"));
check("highlight ranges are safe indexes", matchRanges("Advanced OSPF", "ospf")[0]?.[0] === 9);

// Duplicate-safety: re-importing identical annotations must not duplicate results.
const duplicated = runSearch("packet page 12", { ...sources, notes: [...notes] }, DEFAULT_FILTERS);
check("no duplicate note results", duplicated.notes.length === 1);

if (failures > 0) {
  console.error(`\n${failures} search test(s) failed`);
  process.exit(1);
}
console.log("\nAll search tests passed");
