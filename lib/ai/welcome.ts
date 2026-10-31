/** Welcome drafts for newly registered companies: a congratulations letter and an intro request to a partner. */
import { z } from "zod";
import { hashKey } from "../cache";
import type { ScoredCompany, ScoredRun } from "../types";
import { cachedOnly, cachedStructured, type Generated, type Runner } from "./client";
import { companyFacts, factsFingerprint } from "./facts";

const PROMPT_VERSION = "welcome-1";

export const welcomeSchema = z.object({
  letterSubjectDe: z.string().describe("German subject line of the congratulations letter."),
  letterBodyDe: z
    .string()
    .describe("German congratulations letter, formal 'Sie', 120 to 180 words, starting with 'Sehr geehrte Damen und Herren,' and ending with 'Mit freundlichen Grüßen'."),
  introRequestDe: z
    .string()
    .describe("German message to a partner (tax advisor, guild or wholesaler) asking for a short introduction, 50 to 90 words, addressing the partner as '[Name]'."),
});

export type WelcomeDrafts = z.infer<typeof welcomeSchema>;

const INSTRUCTIONS = `You write two short German drafts for a software company that sells field-service software to HVAC (SHK) contractors.
The recipient company was registered recently. 1) A congratulations letter with a starter offer at the given monthly price. 2) A message to a partner who may know the founders, asking for a warm introduction.
Formal German ("Sie"), warm but sober, no exaggeration, no invented facts about the company or its founders. Mention that the company can try the software with its data already set up, and that we first want to hear what they need in their first year.
Every letter offers an easy opt-out ("Möchten Sie keine weiteren Briefe von uns erhalten, genügt eine kurze Nachricht.").`;

function key(company: ScoredCompany): string {
  return hashKey(PROMPT_VERSION, factsFingerprint(company));
}

export function welcomeFor(
  company: ScoredCompany,
  run: Pick<ScoredRun, "threshold">,
  options: { runner?: Runner; refresh?: boolean; cacheRoot?: string } = {},
): Promise<Generated<WelcomeDrafts>> {
  return cachedStructured(
    "welcome",
    key(company),
    { schema: welcomeSchema, name: "welcome_drafts", instructions: INSTRUCTIONS, input: companyFacts(company, run) },
    options,
  );
}

export function cachedWelcome(company: ScoredCompany, cacheRoot?: string): Generated<WelcomeDrafts> | null {
  return cachedOnly("welcome", key(company), welcomeSchema, cacheRoot);
}
