/**
 * Needle LinkedIn outreach, ported from the team's needle/linkedin_outreach.py: JSON-RPC
 * "tools/call" against Needle's MCP endpoint with a Bearer key. Server-side only.
 */
import { z } from "zod";

export const NEEDLE_MCP_URL = "https://needle.app/mcp/v1";

export class NeedleNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(`Needle not configured: ${missing.join(" and ")} missing in .env.local.`);
    this.name = "NeedleNotConfiguredError";
  }
}

export class NeedleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeedleError";
  }
}

export function needleStatus(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.NEEDLE_API_KEY) missing.push("NEEDLE_API_KEY");
  if (!process.env.NEEDLE_CONNECTED_ACCOUNT_ID) missing.push("NEEDLE_CONNECTED_ACCOUNT_ID");
  return { configured: missing.length === 0, missing };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Reads a JSON-RPC answer from a plain JSON body or from SSE "data:" lines; returns the tool's JSON result. */
export function parseMcpBody(body: string): unknown {
  const candidates: unknown[] = [];
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) candidates.push(JSON.parse(trimmed));
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith("data:")) candidates.push(JSON.parse(line.slice(5).trim()));
  }
  for (const data of candidates) {
    const msg = data as { error?: { message?: string } | string; result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean } };
    if (msg.error) throw new NeedleError(typeof msg.error === "string" ? msg.error : (msg.error.message ?? "Needle returned an error"));
    if (!msg.result) continue;
    const first = msg.result.content?.[0];
    if (first?.type === "text" && typeof first.text === "string") {
      if (msg.result.isError) throw new NeedleError(first.text);
      try {
        return JSON.parse(first.text);
      } catch {
        return { raw: first.text };
      }
    }
    return msg.result;
  }
  throw new NeedleError("Needle returned no result");
}

export const peopleHitSchema = z
  .object({
    identity: z.string().nullish(),
    publicIdentifier: z.string().nullish(),
    providerId: z.string().nullish(),
    name: z.string().nullish(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    headline: z.string().nullish(),
    location: z.string().nullish(),
    profileUrl: z.string().nullish(),
    degree: z.union([z.string(), z.number()]).nullish(),
  })
  .loose();

export type PersonHit = { identity: string; name: string; headline: string; location: string; profileUrl: string; degree: string };

/** The profile slug from a LinkedIn URL, e.g. https://www.linkedin.com/in/jane-doe-123/ → jane-doe-123. */
export function identityFromUrl(url: string | null | undefined): string | null {
  const m = url?.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export function toPersonHit(raw: z.infer<typeof peopleHitSchema>): PersonHit | null {
  const identity = raw.identity ?? raw.publicIdentifier ?? identityFromUrl(raw.profileUrl) ?? raw.providerId;
  if (!identity) return null;
  const name = raw.name ?? [raw.firstName, raw.lastName].filter(Boolean).join(" ");
  return {
    identity,
    name: name || identity,
    headline: raw.headline ?? "",
    location: raw.location ?? "",
    profileUrl: raw.profileUrl ?? `https://www.linkedin.com/in/${identity}/`,
    degree: raw.degree == null ? "" : String(raw.degree),
  };
}

export interface NeedleClient {
  searchPeople(input: { keywords: string; company?: string; title?: string; limit?: number }): Promise<PersonHit[]>;
  composePreview(input: { identity: string; prompt: string }): Promise<string>;
  sendInvitation(input: { identity: string; note?: string }): Promise<unknown>;
  sendMessage(input: { identity: string; text: string }): Promise<unknown>;
}

export function createNeedleClient(options: { apiKey?: string; accountId?: string; fetchImpl?: FetchLike } = {}): NeedleClient {
  const apiKey = options.apiKey ?? process.env.NEEDLE_API_KEY;
  const accountId = options.accountId ?? process.env.NEEDLE_CONNECTED_ACCOUNT_ID;
  const missing = [!apiKey && "NEEDLE_API_KEY", !accountId && "NEEDLE_CONNECTED_ACCOUNT_ID"].filter(Boolean) as string[];
  if (missing.length) throw new NeedleNotConfiguredError(missing);
  const fetchImpl = options.fetchImpl ?? fetch;

  async function call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await fetchImpl(NEEDLE_MCP_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) throw new NeedleError(`Needle answered ${response.status}: ${text.slice(0, 200)}`);
    return parseMcpBody(text);
  }

  return {
    async searchPeople({ keywords, company, title, limit = 5 }) {
      const advanced: Record<string, string> = {};
      if (company) advanced.company = company;
      if (title) advanced.title = title;
      const result = (await call("needleSearchLinkedinPeopleClassic", {
        connectedAccountId: accountId,
        keywords,
        limit: Math.min(limit, 10),
        ...(Object.keys(advanced).length ? { advancedKeywords: advanced } : {}),
      })) as { hits?: unknown[] };
      return (result.hits ?? [])
        .map((h) => peopleHitSchema.safeParse(h))
        .filter((r) => r.success)
        .map((r) => toPersonHit(r.data))
        .filter((h): h is PersonHit => h !== null);
    },
    async composePreview({ identity, prompt }) {
      const result = (await call("needleComposePreview", { channel: "linkedin", connectedAccountId: accountId, identity, context: ["profile"], prompt })) as { text?: string; raw?: string };
      const text = result.text ?? result.raw;
      if (!text) throw new NeedleError("Needle returned no message text");
      return text;
    },
    async sendInvitation({ identity, note }) {
      return call("needleSendLinkedinInvitation", { connectedAccountId: accountId, identity, ...(note ? { note: note.slice(0, 300) } : {}) });
    },
    async sendMessage({ identity, text }) {
      return call("needleSendLinkedinMessage", { connectedAccountId: accountId, identity, text });
    },
  };
}
