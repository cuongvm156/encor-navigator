import { DEMO_AUDIO_URL, DEMO_RESOURCE_ID } from "@/config/demoAudio";
import type { Chapter, ChapterProgress, Course, Note, Part, Resource } from "./types";

/**
 * Official book structure — CCNP and CCIE Enterprise Core ENCOR 350-401
 * Official Cert Guide, 2nd Edition.
 *
 * Approved application scope: 9 parts, 29 technical chapters.
 * Chapter 30 (Final Preparation) and Chapter 31 (Exam Updates) are explicitly
 * out of scope and are NOT part of course progress.
 *
 * Only confirmed metadata is stored here. Exam weights, study minutes, page
 * counts, audio durations, summaries and objectives are intentionally absent
 * rather than estimated; the UI hides those rows when values are unavailable.
 */
export const parts: Part[] = [
  { id: "part-1", number: 1, title: "Forwarding" },
  { id: "part-2", number: 2, title: "Layer 2" },
  { id: "part-3", number: 3, title: "Routing" },
  { id: "part-4", number: 4, title: "Services" },
  { id: "part-5", number: 5, title: "Overlay" },
  { id: "part-6", number: 6, title: "Wireless" },
  { id: "part-7", number: 7, title: "Architecture" },
  { id: "part-8", number: 8, title: "Security" },
  { id: "part-9", number: 9, title: "SDN" },
];

export const course: Course = {
  id: "encor-350-401",
  code: "350-401",
  title: "CCNP ENCOR",
  vendor: "Cisco",
  description:
    "Implementing and Operating Cisco Enterprise Network Core Technologies — nine book parts and 29 technical chapters.",
  parts,
};

export const chapters: Chapter[] = [
  {
    id: "ch-01",
    partId: "part-1",
    number: 1,
    title: "Packet Forwarding",
    // Temporary smoke-test document. Its content does not match this chapter.
    // The official ENCOR Chapter 1 PDF will use "encor-v2-ch01-packet-forwarding-v1".
    pdfResourceId: "test-clcor-ch01-v1",
    pdfUrl: "/pdfs/encor-v2-ch01-packet-forwarding.pdf",
    // TEMPORARY development smoke-test audio — Chapter 1 only. Chapters 2-29
    // have no audio and must never inherit this source.
    audioResourceId: DEMO_RESOURCE_ID,
    audioUrl: DEMO_AUDIO_URL,
  },
  { id: "ch-02", partId: "part-2", number: 2, title: "Spanning Tree Protocol" },
  { id: "ch-03", partId: "part-2", number: 3, title: "Advanced STP Tuning" },
  { id: "ch-04", partId: "part-2", number: 4, title: "Multiple Spanning Tree Protocol" },
  { id: "ch-05", partId: "part-2", number: 5, title: "VLAN Trunks and EtherChannel Bundles" },
  { id: "ch-06", partId: "part-3", number: 6, title: "IP Routing Essentials" },
  { id: "ch-07", partId: "part-3", number: 7, title: "EIGRP" },
  { id: "ch-08", partId: "part-3", number: 8, title: "OSPF" },
  { id: "ch-09", partId: "part-3", number: 9, title: "Advanced OSPF" },
  { id: "ch-10", partId: "part-3", number: 10, title: "OSPFv3" },
  { id: "ch-11", partId: "part-3", number: 11, title: "BGP" },
  { id: "ch-12", partId: "part-3", number: 12, title: "Advanced BGP" },
  { id: "ch-13", partId: "part-3", number: 13, title: "Multicast" },
  { id: "ch-14", partId: "part-4", number: 14, title: "Quality of Service (QoS)" },
  { id: "ch-15", partId: "part-4", number: 15, title: "IP Services" },
  { id: "ch-16", partId: "part-5", number: 16, title: "Overlay Tunnels" },
  { id: "ch-17", partId: "part-6", number: 17, title: "Wireless Signals and Modulation" },
  { id: "ch-18", partId: "part-6", number: 18, title: "Wireless Infrastructure" },
  {
    id: "ch-19",
    partId: "part-6",
    number: 19,
    title: "Understanding Wireless Roaming and Location Services",
  },
  { id: "ch-20", partId: "part-6", number: 20, title: "Authenticating Wireless Clients" },
  { id: "ch-21", partId: "part-6", number: 21, title: "Troubleshooting Wireless Connectivity" },
  { id: "ch-22", partId: "part-7", number: 22, title: "Enterprise Network Architecture" },
  { id: "ch-23", partId: "part-7", number: 23, title: "Fabric Technologies" },
  { id: "ch-24", partId: "part-7", number: 24, title: "Network Assurance" },
  { id: "ch-25", partId: "part-8", number: 25, title: "Secure Network Access Control" },
  {
    id: "ch-26",
    partId: "part-8",
    number: 26,
    title: "Network Device Access Control and Infrastructure Security",
  },
  { id: "ch-27", partId: "part-9", number: 27, title: "Virtualization" },
  {
    id: "ch-28",
    partId: "part-9",
    number: 28,
    title: "Foundational Network Programmability Concepts",
  },
  { id: "ch-29", partId: "part-9", number: 29, title: "Introduction to Automation Tools" },
];

/**
 * No demo resources: the retired 13-chapter demo catalogue must not appear
 * under the official chapter titles. Real resources arrive with real content.
 */
export const resources: Resource[] = [];

/**
 * No demo progress. Real reading/playback progress lives in IndexedDB and is
 * read through the repositories.
 */
export const progressById: Record<string, ChapterProgress> = {};

export const getPart = (partId: string) => parts.find((p) => p.id === partId);
export const getChapter = (chapterId: string) => chapters.find((c) => c.id === chapterId);
export const chaptersInPart = (partId: string) => chapters.filter((c) => c.partId === partId);
export const resourcesForChapter = (chapterId: string) =>
  resources.filter((r) => r.chapterId === chapterId);

/** No demo notes or bookmarks — user-created records live in IndexedDB. */
export const notes: Note[] = [];

export const notesForChapter = (chapterId: string) => notes.filter((n) => n.chapterId === chapterId);

export const recentChapters = (limit = 4) =>
  chapters
    .filter((c) => progressById[c.id]?.lastOpened)
    .sort((a, b) =>
      (progressById[b.id]?.lastOpened ?? "").localeCompare(progressById[a.id]?.lastOpened ?? ""),
    )
    .slice(0, limit);
