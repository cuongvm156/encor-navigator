/**
 * Domain-weighted ENCOR v1.2 exam progress (Sprint 7A).
 *
 * Chapter completion keeps using the central Reading 60% / Media 40% rule in
 * `weights.ts` — nothing here changes it. This module only aggregates chapter
 * completion into exam-domain and overall v1.2 exam progress.
 */

import {
  chaptersInDomain,
  chaptersInSection,
  domainChapterIds,
  examDomains,
  TOTAL_DOMAIN_WEIGHT,
} from "@/features/course/examDomains";
import type { ChapterProgress, DomainSection, ExamDomain } from "@/features/course/types";

import { chapterCompletion } from "./weights";

type ProgressMap = Record<string, ChapterProgress>;

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

/** Average chapter completion of the chapters mapped to a domain (0..1). */
export function domainCompletion(domain: ExamDomain, progressById: ProgressMap): number {
  return mean(chaptersInDomain(domain.id).map((c) => chapterCompletion(progressById[c.id])));
}

/** Average chapter completion of an Infrastructure subsection (0..1). */
export function sectionCompletion(section: DomainSection, progressById: ProgressMap): number {
  return mean(chaptersInSection(section.id).map((c) => chapterCompletion(progressById[c.id])));
}

/** Overall v1.2 exam progress = sum(domainCompletion × domainWeight) / 100. */
export function weightedExamCompletion(progressById: ProgressMap): number {
  if (TOTAL_DOMAIN_WEIGHT === 0) return 0;
  const total = examDomains.reduce(
    (sum, domain) => sum + domainCompletion(domain, progressById) * domain.weight,
    0,
  );
  return total / TOTAL_DOMAIN_WEIGHT;
}

/** Number of active chapters mapped to a domain. */
export const domainChapterCount = (domain: ExamDomain) => domainChapterIds(domain).length;
