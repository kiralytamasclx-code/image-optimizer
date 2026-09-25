// Second pass: Claude reads each job that passed the keyword filter and decides
// whether it's really a product design role, its seniority and where it's based.
// Only runs when ANTHROPIC_API_KEY is set; otherwise the keyword verdict stands.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { keywordVerdict } from "./keywords.js";
import type { RawJob, Verdict } from "./types.js";

const MODEL = "claude-opus-5";

const VerdictSchema = z.object({
  isDesignRole: z.boolean(),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead", "unknown"]),
  locationFit: z.enum(["romania", "remote_eu", "out_of_scope", "unknown"]),
  summary: z.string(),
});

const SYSTEM = `You sort job posts for a product designer looking for work at Romanian SaaS startups.

For the job post you're given, decide:
- isDesignRole: true for product, UX, UI, interaction, visual or brand design roles in software, UX research, and design leadership (Head of Design, Design Manager). Design engineers count when the role is mostly design. False for engineering, hardware, graphic print work, instructional design, and roles that only mention design in passing.
- seniority: judge from the title first, then from years of experience and responsibilities in the text. "lead" covers lead, principal, staff, head of and manager roles. Use "unknown" only when there are no clues.
- locationFit: "romania" if the job can be done from Romania (office or hybrid in a Romanian city, or remote limited to Romania). "remote_eu" if it's remote and open to people in the EU or Europe. "out_of_scope" if it requires living outside Romania. "unknown" if the post doesn't say.
- summary: two sentences at most on what the person would work on and anything notable (product area, team size, required tools). Write it in English even if the post is in Romanian.`;

let client: Anthropic | null = null;

export function claudeEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function classify(job: RawJob): Promise<Verdict> {
  if (!claudeEnabled()) return keywordVerdict(job);
  client ??= new Anthropic();

  const post = [
    `Company: ${job.company.name}`,
    `Title: ${job.title}`,
    `Location: ${job.location || "not stated"}`,
    `Remote: ${job.remote === null ? "not stated" : job.remote ? "yes" : "no"}`,
    "",
    job.description.slice(0, 8000) || "(no description available)",
  ].join("\n");

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      // Sorting a job post is simple work, so keep thinking short.
      output_config: { effort: "low", format: betaZodOutputFormat(VerdictSchema) },
      // If the request is ever declined, retry it on another model instead of failing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: post }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn(`  Claude gave no verdict for "${job.title}", using keywords`);
      return keywordVerdict(job);
    }
    return { ...response.parsed_output, method: "claude" };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error("ANTHROPIC_API_KEY was rejected. Check the key, or remove it to run on keywords only.");
    }
    if (error instanceof Anthropic.APIError) {
      // Rate limits and server errors are already retried by the SDK. If one
      // still gets through, fall back rather than lose the whole run.
      console.warn(`  Claude API error ${error.status} for "${job.title}", using keywords`);
      return keywordVerdict(job);
    }
    throw error;
  }
}
