const USER_AGENT = "job-search-agent (personal job search; contact via GitHub)";

async function get(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`GET ${url} returned ${res.status}`);
  return res;
}

export async function getJson<T>(url: string): Promise<T> {
  return (await get(url)).json() as Promise<T>;
}

export async function getText(url: string): Promise<string> {
  return (await get(url)).text();
}

/** Turns job description HTML into plain text */
export function htmlToText(html: string): string {
  return html
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
