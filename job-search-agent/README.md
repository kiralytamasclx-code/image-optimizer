# Job Search Agent

A tool to find product design openings (Product / UX / UI / Visual Designer) at Romanian SaaS startups, produce a report, and support a human-in-the-loop apply and outreach process.

> This folder is a staging point. The tool doesn't belong in the `image-optimizer` repo long term; move it to its own repository once the scope is settled.

## Status

Research done and the scope questions are answered (see [Decisions](#decisions)). Nothing built yet.

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

The only running cost is Claude usage for sorting jobs and drafting messages.

**Scope note:** about 121 companies means the first pass could be done by hand in a weekend. The tool's real value is running weekly and flagging *new* openings the day they appear, so build it as a monitor.

## Decisions

Answered September 2026:

1. **Scope:** jobs based in Romania plus remote EU roles at Romanian companies. Romanian-based roles at foreign companies are out for now.
2. **Report destination:** a Google Sheet. It keeps history and lets the user track status for each job (new, applied, messaged).
3. **Frequency:** both. A weekly scheduled run that flags only new openings, plus a manual trigger for checking sooner.
4. **Seniority:** mid, senior and lead. The report should show each job's seniority so it can be filtered or sorted.

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
