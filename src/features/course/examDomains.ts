/**
 * ENCOR v1.2 exam-domain learning structure (Sprint 7A).
 *
 * The Official Cert Guide 2nd Edition catalogue (9 Parts / 29 Chapters) stays
 * untouched in `data.ts` and remains the source of book-location metadata.
 * This module adds the PRIMARY learning taxonomy: six weighted exam domains
 * covering 24 active chapters.
 *
 * Wireless chapters ch-17…ch-21 are retained as OCG reference content but are
 * outside the active ENCOR v1.2 exam scope: they are never mapped to a domain,
 * never counted in domain/exam progress, and never renumbered or deleted.
 */

import { chapters, getPart } from "./data";
import type { Chapter, DomainSection, ExamDomain, Part } from "./types";

/** Chapters retained for reference only — excluded from v1.2 study progress. */
export const REFERENCE_CHAPTER_IDS = ["ch-17", "ch-18", "ch-19", "ch-20", "ch-21"] as const;

export const REFERENCE_NOTE =
  "Wireless chapters 17–21 are retained as OCG reference content but excluded from the ENCOR v1.2 exam study plan.";

export const OUT_OF_SCOPE_LABEL = "OCG reference · Outside ENCOR v1.2 exam scope";

export const examDomains: ExamDomain[] = [
  {
    id: "domain-1",
    number: 1,
    title: "Architecture",
    weight: 15,
    chapterIds: ["ch-01", "ch-14", "ch-22", "ch-23"],
  },
  {
    id: "domain-2",
    number: 2,
    title: "Virtualization",
    weight: 10,
    chapterIds: ["ch-16", "ch-27"],
  },
  {
    id: "domain-3",
    number: 3,
    title: "Infrastructure",
    weight: 30,
    sections: [
      {
        id: "domain-3-1",
        label: "3.1",
        title: "Layer 2",
        focus: "802.1Q trunking, EtherChannel, RSTP, MST, root guard, BPDU guard",
        chapterIds: ["ch-02", "ch-03", "ch-04", "ch-05"],
      },
      {
        id: "domain-3-2",
        label: "3.2",
        title: "Layer 3",
        focus: "So sánh EIGRP/OSPF, OSPFv2/v3, eBGP, best-path selection, PBR",
        chapterIds: ["ch-06", "ch-07", "ch-08", "ch-09", "ch-10", "ch-11", "ch-12"],
      },
      {
        id: "domain-3-3",
        label: "3.3",
        title: "IP Services",
        focus: "NTP/PTP, NAT/PAT, HSRP/VRRP, RPF, PIM-SM, IGMPv2/v3, SSM, bidir PIM, MSDP",
        chapterIds: ["ch-13", "ch-15"],
      },
    ],
  },
  {
    id: "domain-4",
    number: 4,
    title: "Network Assurance",
    weight: 10,
    chapterIds: ["ch-24"],
  },
  {
    id: "domain-5",
    number: 5,
    title: "Security",
    weight: 20,
    chapterIds: ["ch-25", "ch-26"],
  },
  {
    id: "domain-6",
    number: 6,
    title: "Automation & AI",
    weight: 15,
    chapterIds: ["ch-28", "ch-29"],
  },
];

/** Every chapter id mapped to a domain, in domain/section order. */
export function domainChapterIds(domain: ExamDomain): string[] {
  return domain.sections
    ? domain.sections.flatMap((section) => section.chapterIds)
    : (domain.chapterIds ?? []);
}

const chapterById = new Map(chapters.map((c) => [c.id, c]));

const domainByChapterId = new Map<string, ExamDomain>();
const sectionByChapterId = new Map<string, DomainSection>();
for (const domain of examDomains) {
  for (const id of domain.chapterIds ?? []) domainByChapterId.set(id, domain);
  for (const section of domain.sections ?? []) {
    for (const id of section.chapterIds) {
      domainByChapterId.set(id, domain);
      sectionByChapterId.set(id, section);
    }
  }
}

/** Active v1.2 study chapters, in domain order. Excludes ch-17…ch-21. */
export const activeExamChapters: Chapter[] = examDomains
  .flatMap((domain) => domainChapterIds(domain))
  .map((id) => chapterById.get(id))
  .filter((c): c is Chapter => Boolean(c));

const activeIds = new Set(activeExamChapters.map((c) => c.id));

/** True when the chapter is part of the active ENCOR v1.2 study plan. */
export const isInActiveExamScope = (chapterId: string) => activeIds.has(chapterId);

export const getExamDomain = (domainId: string) => examDomains.find((d) => d.id === domainId);

export const getExamSection = (sectionId: string) =>
  examDomains.flatMap((d) => d.sections ?? []).find((s) => s.id === sectionId);

export const chaptersInDomain = (domainId: string): Chapter[] => {
  const domain = getExamDomain(domainId);
  if (!domain) return [];
  return domainChapterIds(domain)
    .map((id) => chapterById.get(id))
    .filter((c): c is Chapter => Boolean(c));
};

export const chaptersInSection = (sectionId: string): Chapter[] => {
  const section = getExamSection(sectionId);
  if (!section) return [];
  return section.chapterIds
    .map((id) => chapterById.get(id))
    .filter((c): c is Chapter => Boolean(c));
};

/** Exam domain that owns a chapter, or undefined for reference-only chapters. */
export const domainOfChapter = (chapterId: string) => domainByChapterId.get(chapterId);

/** Infrastructure subsection of a chapter, when it has one. */
export const sectionOfChapter = (chapterId: string) => sectionByChapterId.get(chapterId);

/** Original OCG book part of a chapter — secondary reference metadata. */
export const bookPartOfChapter = (chapter: Chapter): Part | undefined => getPart(chapter.partId);

export const TOTAL_DOMAIN_WEIGHT = examDomains.reduce((sum, d) => sum + d.weight, 0);

/** Development-time invariants — pure checks, safe to call in tests. */
export function validateExamDomains(): string[] {
  const errors: string[] = [];
  if (examDomains.length !== 6) errors.push(`expected 6 domains, got ${examDomains.length}`);
  if (TOTAL_DOMAIN_WEIGHT !== 100) errors.push(`weights total ${TOTAL_DOMAIN_WEIGHT}, expected 100`);

  const all = examDomains.flatMap(domainChapterIds);
  if (new Set(all).size !== all.length) errors.push("a chapter is mapped to more than one domain");
  if (all.length !== 24) errors.push(`expected 24 active chapters, got ${all.length}`);
  for (const id of all) {
    if (!chapterById.has(id)) errors.push(`unknown chapter id mapped: ${id}`);
  }
  for (const id of REFERENCE_CHAPTER_IDS) {
    if (all.includes(id)) errors.push(`reference chapter ${id} must not be mapped to a domain`);
  }
  return errors;
}

if (import.meta.env?.DEV) {
  const errors = validateExamDomains();
  if (errors.length > 0) console.error("[examDomains] invalid mapping:", errors);
}
