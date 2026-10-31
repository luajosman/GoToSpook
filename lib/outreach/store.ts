/**
 * What happened with each lead: LinkedIn messages and calls, with the message text and the call
 * transcript. One JSON file per company in data/outreach/ (git-ignored, it holds personal data).
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const DEFAULT_OUTREACH_ROOT = path.join(process.cwd(), "data", "outreach");

export const transcriptLineSchema = z.object({ role: z.string(), message: z.string(), atSecs: z.number().optional() });

export const outreachEventSchema = z.object({
  id: z.string(),
  type: z.enum(["linkedin", "call"]),
  at: z.string(),
  status: z.enum(["sent", "initiated", "in_progress", "done", "failed"]),
  error: z.string().optional(),
  linkedin: z
    .object({
      action: z.enum(["invitation", "message"]),
      identity: z.string(),
      name: z.string(),
      headline: z.string().optional(),
      profileUrl: z.string().optional(),
      text: z.string(),
    })
    .optional(),
  call: z
    .object({
      to: z.string(),
      contactName: z.string().optional(),
      conversationId: z.string().optional(),
      callSid: z.string().optional(),
      providerStatus: z.string().optional(),
      durationSecs: z.number().optional(),
      summary: z.string().optional(),
      transcript: z.array(transcriptLineSchema).optional(),
      syncedAt: z.string().optional(),
    })
    .optional(),
});

export type OutreachEvent = z.infer<typeof outreachEventSchema>;

const fileSchema = z.object({ companyId: z.string(), events: z.array(outreachEventSchema) });

function fileFor(companyId: string, root: string): string {
  return path.join(root, `${companyId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
}

export function listEvents(companyId: string, root: string = DEFAULT_OUTREACH_ROOT): OutreachEvent[] {
  const file = fileFor(companyId, root);
  if (!existsSync(file)) return [];
  try {
    return fileSchema.parse(JSON.parse(readFileSync(file, "utf8"))).events;
  } catch {
    return [];
  }
}

function save(companyId: string, events: OutreachEvent[], root: string) {
  const file = fileFor(companyId, root);
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ companyId, events }, null, 2) + "\n");
  renameSync(tmp, file);
}

export function addEvent(companyId: string, event: Omit<OutreachEvent, "id" | "at"> & { at?: string }, root: string = DEFAULT_OUTREACH_ROOT): OutreachEvent {
  const full = outreachEventSchema.parse({ id: randomUUID(), at: new Date().toISOString(), ...event });
  save(companyId, [...listEvents(companyId, root), full], root);
  return full;
}

export function updateEvent(companyId: string, id: string, patch: (e: OutreachEvent) => OutreachEvent, root: string = DEFAULT_OUTREACH_ROOT): OutreachEvent | null {
  const events = listEvents(companyId, root);
  const i = events.findIndex((e) => e.id === id);
  if (i < 0) return null;
  events[i] = outreachEventSchema.parse(patch(events[i]));
  save(companyId, events, root);
  return events[i];
}
