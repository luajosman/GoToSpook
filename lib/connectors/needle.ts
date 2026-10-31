/**
 * Needle LinkedIn outreach, ported from the team's needle/linkedin_outreach.py: JSON-RPC
 * "tools/call" against Needle's MCP endpoint with a Bearer key. The app finds people and enrolls
 * them in a Needle campaign; Needle writes and sends the messages. Server-side only.
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
  if (!process.env.NEEDLE_CAMPAIGN_ID) missing.push("NEEDLE_CAMPAIGN_ID");
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

export type NeedleCampaign = { id: string; name: string; status: string };
export type NeedleLeadEvent = { id: string; type: string; label: string; at: string; campaignName?: string; text?: string };
export type EnrollResult = { accepted: boolean; reason?: string };

/**
 * needleEnrollCampaignLeads "returns accepted or skipped per lead id"; the exact shape is not published,
 * so this accepts the common forms: { accepted: [...], skipped: [...] } or a list of { leadId, status, reason }.
 */
export function parseEnrollResult(raw: unknown, leadId: string): EnrollResult {
  const result = (raw ?? {}) as Record<string, unknown>;
  const idOf = (x: unknown) => (typeof x === "string" ? x : ((x as Record<string, unknown> | null)?.leadId as string | undefined));
  const reasonOf = (x: unknown) => String((x as Record<string, unknown> | null)?.reason ?? "skipped");
  if (Array.isArray(result.skipped)) {
    const hit = result.skipped.find((x) => idOf(x) === leadId);
    if (hit !== undefined) return { accepted: false, reason: reasonOf(hit) };
  }
  if (Array.isArray(result.accepted) && result.accepted.some((x) => idOf(x) === leadId)) return { accepted: true };
  const rows = ["results", "enrollments", "items"].map((k) => result[k]).find(Array.isArray) as unknown[] | undefined;
  const row = (rows?.find((r) => idOf(r) === leadId) ?? rows?.[0]) as Record<string, unknown> | undefined;
  if (row) {
    const status = String(row.status ?? row.result ?? "");
    if (status === "accepted" || status === "enrolled") return { accepted: true };
    return { accepted: false, reason: String(row.reason ?? (status || "skipped")) };
  }
  return { accepted: true };
}

export interface NeedleClient {
  searchPeople(input: { keywords: string; company?: string; title?: string; limit?: number }): Promise<PersonHit[]>;
  getCampaign(campaignId: string): Promise<NeedleCampaign>;
  upsertLead(input: { linkedin: string; firstName?: string; lastName?: string; companyName?: string; companyDomain?: string; jobTitle?: string; timezone: string }): Promise<{ leadId: string; created: boolean }>;
  enrollLead(campaignId: string, leadId: string): Promise<EnrollResult>;
  getLeadEnrollment(leadId: string, campaignId: string): Promise<string | null>;
  listLeadEvents(leadId: string): Promise<NeedleLeadEvent[]>;
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
    async getCampaign(campaignId) {
      const result = (await call("needleGetCampaign", { campaignId })) as { campaign?: { id?: string; name?: string; status?: string } };
      const c = result.campaign;
      if (!c?.id) throw new NeedleError("Needle returned no campaign");
      return { id: c.id, name: c.name ?? "", status: c.status ?? "unknown" };
    },
    async upsertLead({ linkedin, timezone, ...fields }) {
      const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => [k, (v as string).slice(0, 256)]));
      const result = (await call("needleUpsertLead", { identities: { linkedin }, timezone, ...clean })) as {
        lead?: { id?: string };
        leadId?: string;
        id?: string;
        status?: string;
        result?: string;
        created?: boolean;
      };
      const leadId = result.lead?.id ?? result.leadId ?? result.id;
      if (!leadId) throw new NeedleError("Needle returned no lead id");
      const created = result.created ?? (result.status ?? result.result) === "created";
      return { leadId, created };
    },
    async enrollLead(campaignId, leadId) {
      return parseEnrollResult(await call("needleEnrollCampaignLeads", { campaignId, leadIds: [leadId] }), leadId);
    },
    async getLeadEnrollment(leadId, campaignId) {
      const result = (await call("needleGetLead", { leadId })) as { lead?: { enrollments?: Array<Record<string, unknown>> } };
      const enrollment = (result.lead?.enrollments ?? []).find((e) => e.campaignId === campaignId) ?? result.lead?.enrollments?.[0];
      return enrollment ? String(enrollment.status ?? enrollment.state ?? "enrolled") : null;
    },
    async listLeadEvents(leadId) {
      const result = (await call("needleListLeadEvents", { leadId, limit: 100 })) as { events?: Array<Record<string, unknown>> };
      return (result.events ?? []).map((e) => {
        const data = (e.data ?? {}) as { text?: unknown };
        return {
          id: String(e.id ?? ""),
          type: String(e.type ?? ""),
          label: String(e.label ?? e.type ?? ""),
          at: String(e.occurredAt ?? ""),
          ...(typeof e.campaignName === "string" ? { campaignName: e.campaignName } : {}),
          ...(typeof data.text === "string" && data.text ? { text: data.text } : {}),
        };
      });
    },
  };
}
