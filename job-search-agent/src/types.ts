export type Ats = "greenhouse" | "lever" | "ashby" | "workable" | "recruitee" | "html";

export interface Careers {
  ats: Ats;
  /** Board name for ATS feeds, e.g. "planable" in jobs.lever.co/planable */
  slug?: string;
  /** Careers page URL, used when ats is "html" */
  url?: string;
}

export interface Company {
  name: string;
  website: string;
  linkedin?: string;
  /** Filled in by `npm run detect`, or by hand */
  careers?: Careers;
}

/** A job as fetched from a source, before filtering */
export interface RawJob {
  company: Company;
  /** Stable across runs, used to tell new jobs from ones already reported */
  key: string;
  title: string;
  url: string;
  location: string;
  remote: boolean | null;
  postedAt: string | null;
  description: string;
}

export type Seniority = "intern" | "junior" | "mid" | "senior" | "lead" | "unknown";
export type LocationFit = "romania" | "remote_eu" | "out_of_scope" | "unknown";

export interface Verdict {
  isDesignRole: boolean;
  seniority: Seniority;
  locationFit: LocationFit;
  summary: string;
  /** "claude" or "keywords", so the report shows how sure it is */
  method: "claude" | "keywords";
}

export interface SeenJob {
  key: string;
  company: string;
  title: string;
  url: string;
  linkedin: string;
  location: string;
  postedAt: string | null;
  firstSeen: string;
  verdict: Verdict;
  /** True when the job passed every filter and went into the report */
  reported: boolean;
}
