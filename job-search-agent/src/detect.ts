// `npm run detect`: for each company in companies.json with no careers entry,
// visit its website, find the careers page and work out which hiring system
// (ATS) it uses. Writes what it finds back into companies.json. Check the
// result by hand: a wrong slug just means that company's jobs fail to load,
// and the weekly Issue lists it under "Problems".

import { readFileSync, writeFileSync } from "node:fs";
import { getText } from "./http.js";
import type { Careers, Company } from "./types.js";

const ATS_PATTERNS: [Careers["ats"], RegExp][] = [
  ["greenhouse", /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]+)/i],
  ["greenhouse", /boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/i],
  ["lever", /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)/i],
  ["ashby", /jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i],
  ["workable", /apply\.workable\.com\/([a-z0-9_-]+)/i],
  ["recruitee", /([a-z0-9-]+)\.recruitee\.com/i],
];
const IGNORED_SLUGS = new Set(["embed", "api", "j", "widget", "careers", "www"]);

// Romanian sites often say "cariere" or "joburi".
const CAREERS_LINK = /href=["']([^"']*(?:careers?|jobs?|join|hiring|cariere|joburi|angajari)[^"']*)["']/gi;

function findAts(html: string): Careers | null {
  for (const [ats, pattern] of ATS_PATTERNS) {
    const slug = html.match(pattern)?.[1];
    if (slug && !IGNORED_SLUGS.has(slug.toLowerCase())) return { ats, slug };
  }
  const teamtailor = html.match(/https?:\/\/([a-z0-9-]+)\.teamtailor\.com/i);
  if (teamtailor) return { ats: "html", url: `https://${teamtailor[1]}.teamtailor.com/jobs` };
  return null;
}

async function detect(company: Company): Promise<Careers | null> {
  const home = await getText(company.website);
  const direct = findAts(home);
  if (direct) return direct;

  const links = [...new Set([...home.matchAll(CAREERS_LINK)].map((m) => new URL(m[1], company.website).toString()))]
    .filter((url) => !/linkedin\.com|facebook\.com|twitter\.com|x\.com/.test(url))
    .slice(0, 3);
  for (const url of links) {
    // Links straight to an ATS count even if the ATS page itself won't load.
    const fromUrl = findAts(url);
    if (fromUrl) return fromUrl;
    try {
      const found = findAts(await getText(url));
      if (found) return found;
    } catch {
      continue;
    }
  }
  // No ATS, but a careers page on the company's own site: read that directly.
  return links[0] ? { ats: "html", url: links[0] } : null;
}

async function main() {
  const companies = JSON.parse(readFileSync("companies.json", "utf8")) as Company[];
  for (const company of companies.filter((c) => !c.careers)) {
    try {
      const careers = await detect(company);
      if (careers) {
        company.careers = careers;
        console.log(`${company.name}: ${careers.ats} ${careers.slug ?? careers.url}`);
      } else {
        console.log(`${company.name}: no careers page found, add it by hand`);
      }
    } catch (error) {
      console.log(`${company.name}: couldn't load website (${(error as Error).message})`);
    }
  }
  writeFileSync("companies.json", JSON.stringify(companies, null, 2) + "\n");
}

main();
