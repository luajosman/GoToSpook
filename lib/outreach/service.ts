/**
 * Outreach actions behind the lead page's LinkedIn and phone buttons. LinkedIn: the app enrolls a person
 * in a Needle campaign and Needle sends. Calls: an ElevenLabs agent. Every action needs a confirm click,
 * is logged on the lead, and is guarded against repeats.
 */
import { config } from "../config";
import { createCallClient, type CallClient } from "../connectors/elevenlabs";
import { createNeedleClient, NeedleNotConfiguredError, type NeedleCampaign, type NeedleClient, type PersonHit } from "../connectors/needle";
import { normalizeFaxNumber } from "../fax/number";
import type { ScoredCompany } from "../types";
import { addEvent, listEvents, updateEvent, type OutreachEvent } from "./store";

export class OutreachBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachBlockedError";
  }
}

export type OutreachDeps = { needle?: NeedleClient; calls?: CallClient; root?: string; now?: () => Date };

const DAY = 86_400_000;

export function needleCampaignId(): string {
  const id = process.env.NEEDLE_CAMPAIGN_ID;
  if (!id) throw new NeedleNotConfiguredError(["NEEDLE_CAMPAIGN_ID"]);
  return id;
}

export async function searchLinkedinPeople(company: ScoredCompany, query: { keywords?: string; title?: string }, deps: OutreachDeps = {}): Promise<PersonHit[]> {
  const needle = deps.needle ?? createNeedleClient();
  return needle.searchPeople({ keywords: query.keywords?.trim() || company.name, company: company.name, title: query.title?.trim() || undefined, limit: 8 });
}

export async function campaignInfo(deps: OutreachDeps = {}): Promise<NeedleCampaign> {
  const needle = deps.needle ?? createNeedleClient();
  return needle.getCampaign(needleCampaignId());
}

function splitName(name: string): { firstName?: string; lastName?: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ? { firstName: parts[0] } : {};
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) };
}

/** Adds the person to Needle as a lead and enrolls them in the campaign; Needle writes and sends the messages. */
export async function enrollInCampaign(
  company: ScoredCompany,
  input: { person: Pick<PersonHit, "identity" | "name" | "headline" | "profileUrl"> },
  deps: OutreachDeps = {},
): Promise<OutreachEvent> {
  const now = (deps.now ?? (() => new Date()))();
  const campaignId = needleCampaignId();
  const already = listEvents(company.id, deps.root).find(
    (e) => e.type === "linkedin" && e.status === "enrolled" && e.linkedin?.identity === input.person.identity && e.needle?.campaignId === campaignId,
  );
  if (already) throw new OutreachBlockedError(`${input.person.name} is already in this campaign since ${already.at.slice(0, 10)}.`);

  const needle = deps.needle ?? createNeedleClient();
  const linkedin = { action: "campaign" as const, identity: input.person.identity, name: input.person.name, headline: input.person.headline || undefined, profileUrl: input.person.profileUrl || undefined };
  try {
    const campaign = await needle.getCampaign(campaignId);
    const domain = company.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const { leadId } = await needle.upsertLead({
      linkedin: input.person.profileUrl || input.person.identity,
      timezone: "Europe/Berlin",
      ...splitName(input.person.name),
      companyName: company.name,
      ...(domain ? { companyDomain: domain } : {}),
      ...(input.person.headline ? { jobTitle: input.person.headline } : {}),
    });
    const result = await needle.enrollLead(campaignId, leadId);
    if (!result.accepted) throw new OutreachBlockedError(`Needle did not enroll ${input.person.name}: ${result.reason}.`);
    return addEvent(
      company.id,
      { type: "linkedin", status: "enrolled", at: now.toISOString(), linkedin, needle: { leadId, campaignId, campaignName: campaign.name, campaignStatus: campaign.status } },
      deps.root,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addEvent(company.id, { type: "linkedin", status: "failed", at: now.toISOString(), linkedin, error: message }, deps.root);
    throw error;
  }
}

/** Pulls the lead's enrollment status and events (invitations, messages with their text) from Needle. */
export async function syncNeedleLead(company: ScoredCompany, eventId: string, deps: OutreachDeps = {}): Promise<OutreachEvent> {
  const event = listEvents(company.id, deps.root).find((e) => e.id === eventId);
  if (!event?.needle) throw new OutreachBlockedError("No Needle enrollment on this lead.");
  const needle = deps.needle ?? createNeedleClient();
  const [enrollment, events, campaign] = await Promise.all([
    needle.getLeadEnrollment(event.needle.leadId, event.needle.campaignId),
    needle.listLeadEvents(event.needle.leadId),
    needle.getCampaign(event.needle.campaignId),
  ]);
  const now = (deps.now ?? (() => new Date()))();
  return updateEvent(
    company.id,
    eventId,
    (e) => ({
      ...e,
      needle: {
        ...e.needle!,
        campaignName: campaign.name,
        campaignStatus: campaign.status,
        ...(enrollment ? { enrollment } : {}),
        events: events
          .filter((x) => x.type !== "lead_created")
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((x) => ({ id: x.id, type: x.type, label: x.label, at: x.at, ...(x.text ? { text: x.text } : {}) })),
        syncedAt: now.toISOString(),
      },
    }),
    deps.root,
  )!;
}

export function callVariables(company: ScoredCompany, contactName?: string): Record<string, string> {
  return {
    seller_name: config.outreach.sellerName,
    company_name: company.name,
    contact_name: contactName?.trim() || "the owner or managing director",
    city: company.address.city ?? "",
    technician_count: String(company.estimate.technicians.value),
  };
}

export async function startCall(company: ScoredCompany, input: { to: string; contactName?: string }, deps: OutreachDeps = {}): Promise<OutreachEvent> {
  const now = (deps.now ?? (() => new Date()))();
  const to = normalizeFaxNumber(input.to);
  if (!to) throw new OutreachBlockedError("That does not look like a phone number. Example: +49 30 1234567.");
  const recent = listEvents(company.id, deps.root).find((e) => e.type === "call" && e.status !== "failed" && now.getTime() - new Date(e.at).getTime() < DAY);
  if (recent) throw new OutreachBlockedError(`${company.name} was already called on ${recent.at.slice(0, 16).replace("T", " ")}. One call per company per day.`);

  const calls = deps.calls ?? createCallClient();
  const call = { to, ...(input.contactName?.trim() ? { contactName: input.contactName.trim() } : {}) };
  try {
    const started = await calls.startCall({ to, variables: callVariables(company, input.contactName) });
    return addEvent(
      company.id,
      { type: "call", status: "initiated", at: now.toISOString(), call: { ...call, ...(started.conversationId ? { conversationId: started.conversationId } : {}), ...(started.callSid ? { callSid: started.callSid } : {}) } },
      deps.root,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addEvent(company.id, { type: "call", status: "failed", at: now.toISOString(), call, error: message }, deps.root);
    throw error;
  }
}

const FINISHED = new Set(["done", "failed"]);

/** Fetches the call's status and transcript from ElevenLabs and stores them on the lead. */
export async function syncCall(company: ScoredCompany, eventId: string, deps: OutreachDeps = {}): Promise<OutreachEvent> {
  const event = listEvents(company.id, deps.root).find((e) => e.id === eventId);
  if (!event || event.type !== "call") throw new OutreachBlockedError("No such call on this lead.");
  if (!event.call?.conversationId) throw new OutreachBlockedError("This call has no conversation id to look up.");
  const calls = deps.calls ?? createCallClient();
  const conversation = await calls.getConversation(event.call.conversationId);
  const now = (deps.now ?? (() => new Date()))();
  const status: OutreachEvent["status"] = conversation.status === "done" ? "done" : conversation.status === "failed" ? "failed" : "in_progress";
  return updateEvent(
    company.id,
    eventId,
    (e) => ({
      ...e,
      status: FINISHED.has(e.status) && status === "in_progress" ? e.status : status,
      call: {
        ...e.call!,
        providerStatus: conversation.status,
        ...(conversation.durationSecs != null ? { durationSecs: conversation.durationSecs } : {}),
        ...(conversation.summary ? { summary: conversation.summary } : {}),
        ...(conversation.transcript.length ? { transcript: conversation.transcript } : {}),
        syncedAt: now.toISOString(),
      },
    }),
    deps.root,
  )!;
}
