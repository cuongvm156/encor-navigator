import type { Chapter, ChapterProgress, Course, Part, Resource } from "./types";

export const parts: Part[] = [
  {
    id: "part-1",
    number: 1,
    title: "Architecture",
    description: "Enterprise design principles, high availability, and cloud deployment models.",
    examWeight: 15,
  },
  {
    id: "part-2",
    number: 2,
    title: "Virtualization",
    description: "Device virtualization, path virtualization, and network overlays.",
    examWeight: 10,
  },
  {
    id: "part-3",
    number: 3,
    title: "Infrastructure",
    description: "Layer 2, Layer 3, wireless, and IP services across the enterprise fabric.",
    examWeight: 30,
  },
  {
    id: "part-4",
    number: 4,
    title: "Network Assurance",
    description: "Diagnostics, monitoring tooling, and model-driven telemetry.",
    examWeight: 10,
  },
  {
    id: "part-5",
    number: 5,
    title: "Security",
    description: "Device access control, infrastructure hardening, and network security design.",
    examWeight: 20,
  },
  {
    id: "part-6",
    number: 6,
    title: "Automation",
    description: "Scripting, APIs, data formats, and controller-based automation tooling.",
    examWeight: 15,
  },
];

export const course: Course = {
  id: "encor-350-401",
  code: "350-401",
  title: "CCNP ENCOR",
  vendor: "Cisco",
  description:
    "Implementing and Operating Cisco Enterprise Network Core Technologies — a personal study track across six exam domains.",
  parts,
};

export const chapters: Chapter[] = [
  {
    id: "ch-01",
    partId: "part-1",
    number: 1,
    title: "Enterprise Network Design",
    summary: "Two-tier and three-tier hierarchies, fabric capacity planning, and SD-Access design.",
    minutes: 55,
    objectives: ["Hierarchical models", "Campus design", "Fabric capacity"],
  },
  {
    id: "ch-02",
    partId: "part-1",
    number: 2,
    title: "High Availability and Redundancy",
    summary: "First-hop redundancy, graceful restart, StackWise, and chassis redundancy.",
    minutes: 45,
    objectives: ["HSRP / VRRP / GLBP", "NSF and SSO", "Switch stacking"],
  },
  {
    id: "ch-03",
    partId: "part-2",
    number: 3,
    title: "Device and Path Virtualization",
    summary: "Hypervisors, virtual switching, VRF-lite, and GRE/IPsec tunnels.",
    minutes: 50,
    objectives: ["VRF-lite", "GRE tunnels", "IPsec basics"],
  },
  {
    id: "ch-04",
    partId: "part-2",
    number: 4,
    title: "Network Overlays",
    summary: "LISP and VXLAN control and data planes used by modern campus fabrics.",
    minutes: 60,
    objectives: ["LISP roles", "VXLAN encapsulation", "Overlay vs underlay"],
  },
  {
    id: "ch-05",
    partId: "part-3",
    number: 5,
    title: "Switching and Spanning Tree",
    summary: "Trunking, EtherChannel, RSTP and MST behaviour in the campus core.",
    minutes: 65,
    objectives: ["EtherChannel", "RSTP/MST", "Trunk pruning"],
  },
  {
    id: "ch-06",
    partId: "part-3",
    number: 6,
    title: "OSPF and EIGRP",
    summary: "Neighbor formation, area types, metric tuning, and route summarization.",
    minutes: 70,
    objectives: ["OSPF areas", "EIGRP metrics", "Summarization"],
  },
  {
    id: "ch-07",
    partId: "part-3",
    number: 7,
    title: "BGP and Wireless Fundamentals",
    summary: "eBGP peering, path selection, AP modes, and roaming behaviour.",
    minutes: 75,
    objectives: ["BGP path selection", "AP modes", "Client roaming"],
  },
  {
    id: "ch-08",
    partId: "part-4",
    number: 8,
    title: "Monitoring and Diagnostics",
    summary: "SPAN, IP SLA, NetFlow, syslog, SNMP, and structured troubleshooting.",
    minutes: 45,
    objectives: ["NetFlow", "IP SLA", "SPAN / RSPAN"],
  },
  {
    id: "ch-09",
    partId: "part-4",
    number: 9,
    title: "Model-Driven Telemetry",
    summary: "YANG models, NETCONF/RESTCONF transport, and streaming subscriptions.",
    minutes: 40,
    objectives: ["YANG", "NETCONF", "Dial-in vs dial-out"],
  },
  {
    id: "ch-10",
    partId: "part-5",
    number: 10,
    title: "Device Access Control",
    summary: "AAA, TACACS+, RADIUS, and secure management plane configuration.",
    minutes: 50,
    objectives: ["AAA model", "TACACS+ vs RADIUS", "Management plane"],
  },
  {
    id: "ch-11",
    partId: "part-5",
    number: 11,
    title: "Infrastructure Security",
    summary: "ACLs, CoPP, port security, DHCP snooping, and dynamic ARP inspection.",
    minutes: 55,
    objectives: ["CoPP", "DAI", "Port security"],
  },
  {
    id: "ch-12",
    partId: "part-6",
    number: 12,
    title: "Automation Foundations",
    summary: "JSON/XML/YAML data formats, REST APIs, and Python scripting for networks.",
    minutes: 60,
    objectives: ["Data formats", "REST APIs", "Python basics"],
  },
  {
    id: "ch-13",
    partId: "part-6",
    number: 13,
    title: "Controllers and Configuration Management",
    summary: "Catalyst Center, SD-WAN vManage, EEM, Ansible, and Puppet concepts.",
    minutes: 50,
    objectives: ["Catalyst Center", "EEM applets", "Ansible vs Puppet"],
  },
];

export const resources: Resource[] = [
  { id: "res-01", chapterId: "ch-01", title: "Campus hierarchy walkthrough", kind: "reading", minutes: 20, source: "Official Cert Guide" },
  { id: "res-02", chapterId: "ch-01", title: "Design notes: collapsed core", kind: "notes", minutes: 10, source: "Personal notes" },
  { id: "res-03", chapterId: "ch-02", title: "FHRP comparison table", kind: "reading", minutes: 15, source: "Official Cert Guide" },
  { id: "res-04", chapterId: "ch-02", title: "StackWise refresher", kind: "video", minutes: 18, source: "Study playlist" },
  { id: "res-05", chapterId: "ch-03", title: "VRF-lite configuration recap", kind: "reading", minutes: 22, source: "Official Cert Guide" },
  { id: "res-06", chapterId: "ch-04", title: "LISP control plane audio recap", kind: "audio", minutes: 14, source: "Commute audio" },
  { id: "res-07", chapterId: "ch-05", title: "MST region planning", kind: "notes", minutes: 12, source: "Personal notes" },
  { id: "res-08", chapterId: "ch-06", title: "OSPF LSA types cheat sheet", kind: "reading", minutes: 16, source: "Official Cert Guide" },
  { id: "res-09", chapterId: "ch-07", title: "BGP best path order drill", kind: "notes", minutes: 10, source: "Personal notes" },
  { id: "res-10", chapterId: "ch-08", title: "NetFlow vs Flexible NetFlow", kind: "reading", minutes: 18, source: "Official Cert Guide" },
  { id: "res-11", chapterId: "ch-09", title: "RESTCONF endpoints reference", kind: "link", minutes: 8, source: "Cisco DevNet" },
  { id: "res-12", chapterId: "ch-10", title: "AAA order of operations", kind: "reading", minutes: 14, source: "Official Cert Guide" },
  { id: "res-13", chapterId: "ch-11", title: "CoPP policy example", kind: "notes", minutes: 11, source: "Personal notes" },
  { id: "res-14", chapterId: "ch-12", title: "JSON and YAML side by side", kind: "reading", minutes: 13, source: "Official Cert Guide" },
  { id: "res-15", chapterId: "ch-13", title: "EEM applet patterns", kind: "link", minutes: 9, source: "Cisco DevNet" },
];

export const progressById: Record<string, ChapterProgress> = {
  "ch-01": { chapterId: "ch-01", readRatio: 1, resourceRatio: 1, lastOpened: "2026-08-18" },
  "ch-02": { chapterId: "ch-02", readRatio: 1, resourceRatio: 0.5, lastOpened: "2026-08-19" },
  "ch-03": { chapterId: "ch-03", readRatio: 0.75, resourceRatio: 0.25, lastOpened: "2026-08-20" },
  "ch-04": { chapterId: "ch-04", readRatio: 0.4, resourceRatio: 0, lastOpened: "2026-08-21" },
  "ch-05": { chapterId: "ch-05", readRatio: 0.6, resourceRatio: 0.5, lastOpened: "2026-08-22" },
  "ch-06": { chapterId: "ch-06", readRatio: 0.2, resourceRatio: 0 },
  "ch-08": { chapterId: "ch-08", readRatio: 0.35, resourceRatio: 0 },
  "ch-10": { chapterId: "ch-10", readRatio: 0.1, resourceRatio: 0 },
};

export const getPart = (partId: string) => parts.find((p) => p.id === partId);
export const getChapter = (chapterId: string) => chapters.find((c) => c.id === chapterId);
export const chaptersInPart = (partId: string) => chapters.filter((c) => c.partId === partId);
export const resourcesForChapter = (chapterId: string) =>
  resources.filter((r) => r.chapterId === chapterId);
