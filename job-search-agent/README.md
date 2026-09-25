# Job Search Agent

A tool to find product design openings (Product / UX / UI / Visual Designer) at Romanian SaaS startups, produce a report, and support a human-in-the-loop apply and outreach process.

> This folder is a staging point. The tool doesn't belong in the `image-optimizer` repo; move the whole folder to the root of its own repository (`job-search-agent`). The GitHub Actions workflow in `.github/workflows/` only runs once it's at a repository's root.

## Status

First version built and tested against sample feeds. It hasn't run against the real ATS feeds yet, because the environment it was built in can't reach them. The first real run happens in GitHub Actions. The company list has 8 starter companies and needs filling in.

## Research findings (September 2026)

### LinkedIn has no usable API for this, free or paid

- **Free, self-serve:** only "Sign In with LinkedIn" and posting to your own feed. Neither can search jobs, companies or people.
- **Job Posting API:** partner-only, for recruiting software to *post* jobs, not search them. LinkedIn is not accepting new partners for it.
- **People search, company data, messaging:** only inside paid enterprise products (Recruiter, Sales Navigator). The Sales Navigator API has reportedly stopped taking new partners.

### Scraping LinkedIn or automating messages is ruled out

- LinkedIn's User Agreement bans scraping and bots that "send or redirect messages". Breaking it puts the job-hunting account itself at risk.
- LinkedIn sued Proxycurl (about $10M ARR from scraped data) in January 2025, and it shut down in July 2025.
- Collecting EU people's names and contact details automatically brings GDPR into play. Keeping outreach manual avoids that.

### Outreach strategy

- At a 20–80 person SaaS startup, HR is usually not the decision-maker for a design hire. Target the founder, CPO, Head of Product or Head of Design instead.
- Sending stays 100% manual. The tool researches and drafts, and the user presses send.
- For companies with no opening, use LinkedIn's **"I'm interested"** button on the company page. It privately tells the company's recruiters. Limits: up to 50 companies, only on companies with a LinkedIn Career Page and a Recruiter subscription, and it expires after a year.
- Turn on LinkedIn job alerts ("product designer", "UX designer", Romania). They're free, allowed, and catch jobs posted only on LinkedIn.

## Recommended architecture

Most startups post jobs through a hiring system (ATS), and LinkedIn shows copies. Most ATSs publish free public job feeds with no key and no login:

| ATS        | Public endpoint                                                               |
| ---------- | ----------------------------------------------------------------------------- |
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`                      |
| Lever      | `https://api.lever.co/v0/postings/{slug}?mode=json`                           |
| Ashby      | `https://api.ashbyhq.com/posting-api/job-board/{slug}`                        |
| Workable   | `https://apply.workable.com/api/v1/widget/accounts/{slug}?details=true`       |
| Teamtailor | Public JSON feed on each company's careers site (official API needs a key)    |
| Recruitee  | Public Offers API on each company's careers site                              |

The pipeline:

1. **Company list:** seed from RomanianStartups.com (SaaS/PaaS category), Latka (about 121 Romanian SaaS companies), StartupBlink and Seedtable. Output a list of company name, website and LinkedIn URL.
2. **Find each careers page:** detect the ATS and store its slug. For a plain careers page on the company's own site, read that page directly (it isn't LinkedIn).
3. **Fetch and filter:** pull jobs and use Claude to decide whether each one is a design role and what its seniority and location are. Keyword matching misses titles like "Digital Designer" or "Design Engineer".
4. **Report:** company, role, job description summary, date posted, apply link, company LinkedIn URL (for the user to open manually).
5. **Human in the loop:** the user reviews and applies. For companies with no openings, the user clicks "I'm interested" and sends a Claude-drafted message to the design or product lead.

Everything runs free except the optional Claude step (see Decisions, point 5).

**Scope note:** about 121 companies means the first pass could be done by hand in a weekend. The tool's real value is running weekly and flagging *new* openings the day they appear, so build it as a monitor.

## Decisions

Answered September 2026:

1. **Scope:** jobs based in Romania plus remote EU roles at Romanian companies. Romanian-based roles at foreign companies are out for now.
2. **Report destination:** a GitHub Issue each week listing new openings (GitHub emails you), plus `jobs.md` with the full history. Optionally, new openings are also added to a Google Sheet through a small Apps Script, which is free and needs no Google Cloud project.
3. **Frequency:** both. A weekly scheduled run that flags only new openings, plus a manual trigger for checking sooner.
4. **Seniority:** mid, senior and lead. Each job's seniority is shown so the list can be filtered. Pick a main level before writing outreach templates.
5. **Cost:** it must stay free or close to it. Keyword matching is free and runs first. Claude only reads the few jobs that look like design roles, at about $0.05–0.50 a week. With no API key set, the tool runs on keywords only at $0. GitHub Actions is free for this workload, even in a private repo.
6. **Stack:** TypeScript, run weekly by GitHub Actions, in its own repository.

## How it works

1. `companies.json` lists each company and its careers source: an ATS name and board slug, or a careers page URL (`"ats": "html"`). `npm run detect` fills these in by visiting each company's website.
2. `npm start` fetches every company's jobs, keeps titles that look like design roles (`src/keywords.ts`), and skips any job it has already checked (`data/seen.json`).
3. If `ANTHROPIC_API_KEY` is set, Claude reads each new candidate and decides whether it's really a design role, its seniority and location, and writes a short summary (`src/classify.ts`). If not, the keyword guess is used.
4. Jobs that are mid level or above and in Romania or remote from the EU go into `jobs.md` and `out/new-jobs.md`. The workflow opens a GitHub Issue from the second file, with a checkbox for each job.
5. Problems (a company whose feed failed, or a careers page with no job links) are listed at the bottom of the Issue, so the list doesn't quietly go stale.

## Setup

1. **Create the repo.** On GitHub, create a private repository called `job-search-agent`. Copy this folder's contents into it (including `.github/`), then commit and push.
2. **Fill in the companies.** Add companies to `companies.json` (name, website, LinkedIn page), then run `npm install` and `npm run detect`. Check the careers entries it adds, and fill in any it couldn't find.
3. **Test locally (optional).** `npm run dry-run` shows what it would report without saving anything.
4. **Turn on Claude (optional).** Create an API key at console.anthropic.com, add a few dollars of credit and set a low monthly spend limit. In the GitHub repo, go to Settings → Secrets and variables → Actions and add it as `ANTHROPIC_API_KEY`.
5. **Add the Google Sheet (optional).**
   1. Create a Sheet, then open Extensions → Apps Script.
   2. Paste in `apps-script/Code.gs` and change `TOKEN` to a long random string.
   3. Click Deploy → New deployment → Web app, with "Execute as: Me" and "Who has access: Anyone". Approve the permission prompt.
   4. Add the web app URL as the secret `SHEET_WEBHOOK_URL` and the token as `SHEET_WEBHOOK_TOKEN`. "Anyone" only means anyone who has the URL. The token stops anyone else from adding rows.
6. **First run.** In the repo's Actions tab, open "Weekly job search" and click "Run workflow". The first run reports every current opening. After that, runs only report new ones.

To catch a design role the keywords missed, add its title pattern to `DESIGN_TITLE` in `src/keywords.ts`.

## Sources

- [LinkedIn Job Posting API overview (Microsoft Learn)](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview?view=li-lts-2026-03)
- [LinkedIn API: What Exists, What's Restricted (Clura)](https://clura.ai/blog/linkedin-api)
- [Is the LinkedIn API Free? (SociaVault)](https://sociavault.com/blog/linkedin-api-free-2026)
- [LinkedIn API 2026: Access, Endpoints, Limits (ConnectSafely)](https://connectsafely.ai/articles/linkedin-api-complete-guide-2026)
- [LinkedIn Wins Legal Case Against Data Scrapers (Social Media Today)](https://www.socialmediatoday.com/news/linkedin-wins-legal-case-data-scrapers-proxycurl/756101/)
- [Prohibited software and extensions (LinkedIn Help)](https://www.linkedin.com/help/linkedin/answer/a1341387)
- [LinkedIn Automation vs MCP: What the Terms Allow (ContentIn)](https://contentin.io/blog/linkedin-mcp-terms-of-service/)
- [Greenhouse, Lever, Ashby, Workable: 4 job APIs (DEV Community)](https://dev.to/neverempty/greenhouse-lever-ashby-workable-4-job-apis-1-dangerous-bug-5b5h)
- [6 ATS Platforms with Public Job Posting APIs (fantastic.jobs)](https://fantastic.jobs/article/ats-with-api)
- [Signal interest in working for a company (LinkedIn Help)](https://www.linkedin.com/help/linkedin/answer/a1380509)
- [RomanianStartups.com SaaS/PaaS category](https://www.romanianstartups.com/startups-category/saas-paas/)
- [Top SaaS Companies in Romania (Latka)](https://getlatka.com/companies/countries/romania)
- [Top startups in Romania (StartupBlink)](https://www.startupblink.com/top-startups/romania)
