// Optional: also add new openings to a Google Sheet. Uses a small Apps Script
// attached to your own Sheet (see apps-script/Code.gs), so it runs under your
// normal Google account with no Google Cloud project and no cost.
// Skipped unless SHEET_WEBHOOK_URL is set.

import type { SeenJob } from "./types.js";

export function sheetEnabled(): boolean {
  return Boolean(process.env.SHEET_WEBHOOK_URL);
}

export async function appendToSheet(jobs: SeenJob[]): Promise<void> {
  if (!sheetEnabled() || jobs.length === 0) return;
  const rows = jobs.map((j) => [
    j.firstSeen.slice(0, 10),
    j.company,
    j.title,
    j.verdict.seniority,
    j.location || j.verdict.locationFit,
    j.verdict.summary,
    j.postedAt?.slice(0, 10) ?? "",
    j.url,
    j.linkedin,
    "New", // Status: yours to change to Applied, Messaged, Rejected...
  ]);
  const res = await fetch(process.env.SHEET_WEBHOOK_URL!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: process.env.SHEET_WEBHOOK_TOKEN ?? "", rows }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok || !text.startsWith("ok")) {
    throw new Error(`Google Sheet didn't accept the rows (${res.status}): ${text.slice(0, 200)}`);
  }
}
