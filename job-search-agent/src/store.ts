// State lives in the repo itself, so it's free and every change is in git history:
// - data/seen.json: every design-looking job already checked, so it isn't checked
//   (or paid for) again and only new ones get reported
// - jobs.md: the full report, newest first
// - out/new-jobs.md: this run's new openings, used as the weekly GitHub Issue body

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SeenJob } from "./types.js";

const SEEN_FILE = "data/seen.json";
const REPORT_FILE = "jobs.md";
const NEW_FILE = "out/new-jobs.md";

function write(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function loadSeen(): Map<string, SeenJob> {
  if (!existsSync(SEEN_FILE)) return new Map();
  const list = JSON.parse(readFileSync(SEEN_FILE, "utf8")) as SeenJob[];
  return new Map(list.map((j) => [j.key, j]));
}

export function saveSeen(seen: Map<string, SeenJob>) {
  const list = [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
  write(SEEN_FILE, JSON.stringify(list, null, 2) + "\n");
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const date = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const where = (j: SeenJob) =>
  j.location || { romania: "Romania", remote_eu: "Remote (EU)", out_of_scope: "", unknown: "Not stated" }[j.verdict.locationFit];

function byNewest(a: SeenJob, b: SeenJob) {
  return b.firstSeen.localeCompare(a.firstSeen) || a.company.localeCompare(b.company);
}

export function saveReport(seen: Map<string, SeenJob>) {
  const jobs = [...seen.values()].filter((j) => j.reported).sort(byNewest);
  const rows = jobs.map((j) =>
    [
      date(j.firstSeen),
      cell(j.company),
      `[${cell(j.title)}](${j.url})`,
      j.verdict.seniority,
      cell(where(j)),
      cell(j.verdict.summary),
      date(j.postedAt),
      j.linkedin ? `[LinkedIn](${j.linkedin})` : "",
    ].join(" | "),
  );
  write(
    REPORT_FILE,
    [
      "# Design openings",
      "",
      "Product design roles at Romanian SaaS companies, in Romania or remote from the EU. Updated by the weekly run; newest first.",
      "",
      "| First seen | Company | Role | Seniority | Location | Summary | Posted | Company page |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...rows.map((r) => `| ${r} |`),
      "",
    ].join("\n"),
  );
}

/** Returns the Issue body, or null when there's nothing new to report */
export function saveNewJobs(newJobs: SeenJob[], problems: string[]): string | null {
  if (newJobs.length === 0) return null;
  const lines = [
    `${newJobs.length} new design opening${newJobs.length === 1 ? "" : "s"} this week. Tick each one once you've applied or messaged someone there.`,
    "",
    ...newJobs.sort(byNewest).map((j) => {
      const details = [j.verdict.seniority, where(j), j.verdict.method === "keywords" ? "keyword match only" : ""]
        .filter(Boolean)
        .join(" · ");
      const summary = j.verdict.summary ? `\n  ${j.verdict.summary}` : "";
      const linkedin = j.linkedin ? ` · [company on LinkedIn](${j.linkedin})` : "";
      return `- [ ] **${j.company}**: [${j.title}](${j.url}) (${details})${linkedin}${summary}`;
    }),
    "",
    "Full list: `jobs.md` in this repo.",
  ];
  if (problems.length) {
    lines.push("", "<details><summary>Problems during this run</summary>", "", ...problems.map((p) => `- ${p}`), "", "</details>");
  }
  const body = lines.join("\n") + "\n";
  write(NEW_FILE, body);
  return body;
}
