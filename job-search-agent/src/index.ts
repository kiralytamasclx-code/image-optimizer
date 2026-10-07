// Weekly run: fetch every company's jobs, keep the new design roles, update the
// report. `npm run dry-run` does everything except saving, and prints what
// the Issue would say.

import { readFileSync } from "node:fs";
import { classify, claudeEnabled } from "./classify.js";
import { isInScope, mightBeDesignRole } from "./keywords.js";
import { appendToSheet, sheetEnabled } from "./sheet.js";
import { fetchJobs } from "./sources.js";
import { loadSeen, saveNewJobs, saveReport, saveSeen } from "./store.js";
import type { Company, RawJob, SeenJob } from "./types.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const companies = JSON.parse(readFileSync("companies.json", "utf8")) as Company[];
  const seen = loadSeen();
  const problems: string[] = [];
  const now = new Date().toISOString();

  console.log(`Sorting with ${claudeEnabled() ? "keywords, then Claude" : "keywords only (no ANTHROPIC_API_KEY)"}`);

  const noCareers = companies.filter((c) => !c.careers);
  if (noCareers.length) {
    problems.push(
      `No careers page set for ${noCareers.length} compan${noCareers.length === 1 ? "y" : "ies"} (run \`npm run detect\`): ${noCareers.map((c) => c.name).join(", ")}`,
    );
  }

  const candidates: RawJob[] = [];
  for (const company of companies.filter((c) => c.careers)) {
    try {
      const jobs = await fetchJobs(company);
      const matches = jobs.filter(mightBeDesignRole);
      console.log(`${company.name}: ${jobs.length} jobs, ${matches.length} look like design`);
      if (jobs.length === 0 && company.careers?.ats === "html") {
        problems.push(`${company.name}: no links found on ${company.careers.url}. The page may load its jobs with JavaScript; check it by hand or find its ATS.`);
      }
      candidates.push(...matches);
    } catch (error) {
      problems.push(`${company.name}: ${(error as Error).message}`);
      console.warn(`${company.name}: failed, ${(error as Error).message}`);
    }
  }

  const fresh = candidates.filter((j) => !seen.has(j.key));
  console.log(`\n${candidates.length} design-looking jobs, ${fresh.length} not checked before`);

  const newJobs: SeenJob[] = [];
  for (const job of fresh) {
    const verdict = await classify(job);
    const record: SeenJob = {
      key: job.key,
      company: job.company.name,
      title: job.title,
      url: job.url,
      linkedin: job.company.linkedin ?? "",
      location: job.location,
      postedAt: job.postedAt,
      firstSeen: now,
      verdict,
      reported: isInScope(verdict),
    };
    seen.set(job.key, record);
    console.log(`  ${record.reported ? "KEEP" : "skip"}  ${job.company.name}: ${job.title} (${verdict.seniority}, ${verdict.locationFit})`);
    if (record.reported) newJobs.push(record);
  }

  if (dryRun) {
    console.log("\nDry run, nothing saved. The Issue would say:\n");
    console.log(newJobs.length ? newJobs.map((j) => `- ${j.company}: ${j.title}`).join("\n") : "(no new openings, no Issue)");
    if (problems.length) console.log(`\nProblems:\n${problems.map((p) => `- ${p}`).join("\n")}`);
    return;
  }

  saveSeen(seen);
  saveReport(seen);
  if (sheetEnabled()) {
    try {
      await appendToSheet(newJobs);
      if (newJobs.length) console.log(`Added ${newJobs.length} rows to the Google Sheet`);
    } catch (error) {
      problems.push((error as Error).message);
      console.warn((error as Error).message);
    }
  }
  const body = saveNewJobs(newJobs, problems);
  console.log(body ? `\n${newJobs.length} new openings written to out/new-jobs.md` : "\nNo new openings this run");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
