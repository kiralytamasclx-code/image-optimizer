// One fetcher per hiring system (ATS). Each turns that system's public job feed
// into RawJob objects. None of these need an API key.
//
// The feed shapes below are read defensively: a missing field becomes "" or null
// rather than crashing the whole run.

import { getJson, getText, htmlToText } from "./http.js";
import type { Company, RawJob } from "./types.js";

type Fetcher = (company: Company, slug: string) => Promise<RawJob[]>;

const greenhouse: Fetcher = async (company, slug) => {
  const data = await getJson<{ jobs?: any[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  );
  return (data.jobs ?? []).map((j) => ({
    company,
    key: `greenhouse:${slug}:${j.id}`,
    title: j.title ?? "",
    url: j.absolute_url ?? "",
    location: j.location?.name ?? "",
    remote: null,
    postedAt: j.first_published ?? j.updated_at ?? null,
    description: htmlToText(j.content ?? ""),
  }));
};

const lever: Fetcher = async (company, slug) => {
  const data = await getJson<any[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  return data.map((j) => ({
    company,
    key: `lever:${slug}:${j.id}`,
    title: j.text ?? "",
    url: j.hostedUrl ?? "",
    location: [j.categories?.location, ...(j.categories?.allLocations ?? [])].filter(Boolean).join(", "),
    remote: j.workplaceType ? j.workplaceType === "remote" : null,
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    description: j.descriptionPlain ?? htmlToText(j.description ?? ""),
  }));
};

const ashby: Fetcher = async (company, slug) => {
  const data = await getJson<{ jobs?: any[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
  );
  return (data.jobs ?? []).map((j) => ({
    company,
    key: `ashby:${slug}:${j.id ?? j.jobUrl}`,
    title: j.title ?? "",
    url: j.jobUrl ?? j.applyUrl ?? "",
    location: [j.location, ...(j.secondaryLocations ?? []).map((l: any) => l.location)]
      .filter(Boolean)
      .join(", "),
    remote: typeof j.isRemote === "boolean" ? j.isRemote : null,
    postedAt: j.publishedAt ?? null,
    description: j.descriptionPlain ?? htmlToText(j.descriptionHtml ?? ""),
  }));
};

const workable: Fetcher = async (company, slug) => {
  const data = await getJson<{ jobs?: any[] }>(
    `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`,
  );
  return (data.jobs ?? []).map((j) => ({
    company,
    key: `workable:${slug}:${j.shortcode ?? j.url}`,
    title: j.title ?? "",
    url: j.url ?? j.application_url ?? "",
    location: [j.city, j.country].filter(Boolean).join(", "),
    remote: typeof j.telecommuting === "boolean" ? j.telecommuting : null,
    postedAt: j.published_on ?? j.created_at ?? null,
    description: htmlToText(j.description ?? ""),
  }));
};

const recruitee: Fetcher = async (company, slug) => {
  const data = await getJson<{ offers?: any[] }>(`https://${slug}.recruitee.com/api/offers/`);
  return (data.offers ?? []).map((j) => ({
    company,
    key: `recruitee:${slug}:${j.id}`,
    title: j.title ?? "",
    url: j.careers_url ?? "",
    location: j.location ?? [j.city, j.country].filter(Boolean).join(", "),
    remote: typeof j.remote === "boolean" ? j.remote : null,
    postedAt: j.published_at ?? j.created_at ?? null,
    description: htmlToText(j.description ?? ""),
  }));
};

/**
 * For a careers page on the company's own site (or a Teamtailor site): collect
 * every link on the page as a possible job. Titles are filtered by keyword
 * later, so menu links like "About us" drop out. Pages that build their job
 * list with JavaScript show no links here; the run log says so.
 */
async function htmlPage(company: Company, pageUrl: string): Promise<RawJob[]> {
  const html = await getText(pageUrl);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = htmlToText(m[2]).replace(/\s+/g, " ").trim();
    if (!title || title.length > 120) continue;
    let url: string;
    try {
      url = new URL(m[1], pageUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    jobs.push({
      company,
      key: `html:${url}`,
      title,
      url,
      location: "",
      remote: null,
      postedAt: null,
      description: "",
    });
  }
  return jobs;
}

const fetchers: Record<Exclude<Company["careers"], undefined>["ats"], Fetcher | null> = {
  greenhouse,
  lever,
  ashby,
  workable,
  recruitee,
  html: null,
};

export async function fetchJobs(company: Company): Promise<RawJob[]> {
  const careers = company.careers;
  if (!careers) return [];
  if (careers.ats === "html") {
    if (!careers.url) throw new Error(`${company.name}: "html" careers needs a url`);
    return htmlPage(company, careers.url);
  }
  if (!careers.slug) throw new Error(`${company.name}: ${careers.ats} careers needs a slug`);
  return fetchers[careers.ats]!(company, careers.slug);
}
