/**
 * Outreach actions behind the lead page's LinkedIn and phone buttons. Every action is started by a
 * person clicking a confirm button, is logged on the lead, and is guarded against repeats.
 */
import { config } from "../config";
import { createCallClient, type CallClient } from "../connectors/elevenlabs";
import { createNeedleClient, type NeedleClient, type PersonHit } from "../connectors/needle";
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

export function defaultLinkedinPrompt(company: ScoredCompany): string {
  const techs = company.estimate.technicians.value;
  return [
    `Write a short, personal first LinkedIn message in German (formal "Sie") from ${config.outreach.sellerName}.`,
    `${config.outreach.sellerName} helps HVAC/SHK trade businesses automate their back office, quotes and technician scheduling.`,
    `The recipient works at ${company.name}${company.address.city ? ` in ${company.address.city}` : ""}, a company with about ${techs} field technicians.`,
    "Use their profile for one specific, true detail. Under 300 characters, no hype, no links, end with one question.",
  ].join(" ");
}

export async function searchLinkedinPeople(company: ScoredCompany, query: { keywords?: string; title?: string }, deps: OutreachDeps = {}): Promise<PersonHit[]> {
  const needle = deps.needle ?? createNeedleClient();
  return needle.searchPeople({ keywords: query.keywords?.trim() || company.name, company: company.name, title: query.title?.trim() || undefined, limit: 8 });
}

export async function previewLinkedinMessage(company: ScoredCompany, identity: string, prompt: string | undefined, deps: OutreachDeps = {}): Promise<string> {
  const needle = deps.needle ?? createNeedleClient();
  return needle.composePreview({ identity, prompt: prompt?.trim() || defaultLinkedinPrompt(company) });
}

export async function sendLinkedin(
  company: ScoredCompany,
  input: { person: Pick<PersonHit, "identity" | "name" | "headline" | "profileUrl">; action: "invitation" | "message"; text: string },
  deps: OutreachDeps = {},
): Promise<OutreachEvent> {
  const now = (deps.now ?? (() => new Date()))();
  const text = input.text.trim();
  if (!text) throw new OutreachBlockedError("The message is empty.");
  if (input.action === "invitation" && text.length > 300) throw new OutreachBlockedError("An invitation note can have at most 300 characters.");
  const repeat = listEvents(company.id, deps.root).find(
    (e) => e.type === "linkedin" && e.status === "sent" && e.linkedin?.identity === input.person.identity && e.linkedin.action === input.action && now.getTime() - new Date(e.at).getTime() < 30 * DAY,
  );
  if (repeat) throw new OutreachBlockedError(`${input.person.name} already got this ${input.action} on ${repeat.at.slice(0, 10)}.`);

  const needle = deps.needle ?? createNeedleClient();
  const linkedin = { action: input.action, identity: input.person.identity, name: input.person.name, headline: input.person.headline || undefined, profileUrl: input.person.profileUrl || undefined, text };
  try {
    if (input.action === "invitation") await needle.sendInvitation({ identity: input.person.identity, note: text });
    else await needle.sendMessage({ identity: input.person.identity, text });
    return addEvent(company.id, { type: "linkedin", status: "sent", at: now.toISOString(), linkedin }, deps.root);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addEvent(company.id, { type: "linkedin", status: "failed", at: now.toISOString(), linkedin, error: message }, deps.root);
    throw error;
  }
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
