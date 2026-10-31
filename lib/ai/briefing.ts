/** Lead briefing: why contact now, talking points and a German opening line, from the evidence. */
import { z } from "zod";
import { hashKey } from "../cache";
import type { ScoredCompany, ScoredRun } from "../types";
import { cachedOnly, cachedStructured, type Generated, type Runner } from "./client";
import { companyFacts, factsFingerprint } from "./facts";

const PROMPT_VERSION = "briefing-1";

export const briefingSchema = z.object({
  whyNow: z.string().describe("Two or three sentences, English: why this company is worth contacting now, based only on the evidence."),
  talkingPoints: z.array(z.string()).describe("Three to five short English bullet points for the conversation."),
  openingLineDe: z.string().describe("One opening sentence in German, formal 'Sie', for a first phone call or letter."),
  watchOut: z.string().describe("One English sentence on what is uncertain or missing in the data; say so plainly when evidence is thin."),
});

export type Briefing = z.infer<typeof briefingSchema>;

const INSTRUCTIONS = `You prepare a short sales briefing for a B2B software company that sells field-service software to HVAC (SHK) contractors in Germany.
Use only the facts and evidence given. Never invent employees, customers, tools, events or numbers. Do not recalculate prices; quote the given ones if useful.
If the evidence is thin, keep the briefing modest and say what is missing.
The team reads English; the opening line is German and addresses the company formally with "Sie". No marketing clichés.`;

function key(company: ScoredCompany): string {
  return hashKey(PROMPT_VERSION, factsFingerprint(company));
}

export function briefingFor(
  company: ScoredCompany,
  run: Pick<ScoredRun, "threshold">,
  options: { runner?: Runner; refresh?: boolean; cacheRoot?: string } = {},
): Promise<Generated<Briefing>> {
  return cachedStructured(
    "briefing",
    key(company),
    { schema: briefingSchema, name: "lead_briefing", instructions: INSTRUCTIONS, input: companyFacts(company, run) },
    options,
  );
}

export function cachedBriefing(company: ScoredCompany, cacheRoot?: string): Generated<Briefing> | null {
  return cachedOnly("briefing", key(company), briefingSchema, cacheRoot);
}
