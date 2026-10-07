// Free, first-pass filtering. Anything these patterns miss never reaches Claude,
// so they lean towards letting too much through: Claude (when a key is set)
// throws out the false positives like "Chip Design Engineer".

import type { LocationFit, RawJob, Seniority, Verdict } from "./types.js";

// Add titles here when you spot a design role the tool missed.
const DESIGN_TITLE =
  /\b(design(er)?|ux|ui|user experience|user interface|interaction|visual|brand designer|product designer|design system|user research(er)?|ux research(er)?)\b/i;

// Titles with "design" in them that are almost never product design roles.
const NOT_DESIGN_TITLE =
  /\b(chip|asic|fpga|hardware|circuit|pcb|mechanical|interior|instructional|solution designer|database design)\b/i;

// Links scraped from a plain careers page include menu items like "Design" or
// "Brand", so those need a title that reads like a job.
const HTML_JOB_TITLE = /\b(designer|ux|ui|researcher|head of design|design lead|design manager)\b/i;

export function mightBeDesignRole(job: RawJob): boolean {
  if (NOT_DESIGN_TITLE.test(job.title)) return false;
  if (job.key.startsWith("html:")) return HTML_JOB_TITLE.test(job.title);
  return DESIGN_TITLE.test(job.title);
}

export function seniorityFromTitle(title: string): Seniority {
  if (/\b(intern|internship|trainee|stagiu|stagiar)\b/i.test(title)) return "intern";
  if (/\b(junior|jr\.?|entry)\b/i.test(title)) return "junior";
  if (/\b(lead|principal|head|director|manager|vp|staff)\b/i.test(title)) return "lead";
  if (/\b(senior|sr\.?)\b/i.test(title)) return "senior";
  if (/\b(mid|medior|intermediate)\b/i.test(title)) return "mid";
  return "unknown";
}

const ROMANIA =
  /\b(romania|românia|bucharest|bucurești|bucuresti|cluj|iasi|iași|timisoara|timișoara|brasov|brașov|sibiu|oradea|constanta|constanța|craiova)\b/i;
const REMOTE_EU = /\b(remote|anywhere|europe|emea|eu|cet|worldwide|global)\b/i;

export function locationFit(job: RawJob): LocationFit {
  const text = `${job.location} ${job.title}`;
  if (ROMANIA.test(text)) return "romania";
  if (job.remote === true || REMOTE_EU.test(text)) return "remote_eu";
  if (!job.location.trim()) return "unknown";
  return "out_of_scope";
}

export function keywordVerdict(job: RawJob): Verdict {
  return {
    isDesignRole: mightBeDesignRole(job),
    seniority: seniorityFromTitle(job.title),
    locationFit: locationFit(job),
    summary: "",
    method: "keywords",
  };
}

/** The decisions from the README: mid, senior or lead; Romania or remote EU */
export function isInScope(v: Verdict): boolean {
  return (
    v.isDesignRole &&
    !["intern", "junior"].includes(v.seniority) &&
    v.locationFit !== "out_of_scope"
  );
}
