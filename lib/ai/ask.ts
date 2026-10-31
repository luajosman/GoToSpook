/** Ask the data: a question about the scored run, answered with the companies it is based on. */
import { z } from "zod";
import { hashKey } from "../cache";
import { MOTION_LABELS } from "../score/motion";
import type { ScoredRun } from "../types";
import { cachedStructured, type Runner } from "./client";

const PROMPT_VERSION = "ask-1";

export const questionSchema = z.string().trim().min(3, "Ask a question of at least a few words.").max(300, "Keep the question under 300 characters.");

export const askSchema = z.object({
  answer: z.string().describe("A short English answer, two to five sentences, based only on the table."),
  companies: z
    .array(z.object({ id: z.string().describe("The company id from the table."), why: z.string().describe("One short reason it is relevant.") }))
    .describe("The companies the answer is based on, most relevant first, at most 10. Empty if none fit."),
});

export type AskAnswer = { answer: string; companies: Array<{ id: string; name: string; why: string }>; generatedAt: string; cached: boolean };

const INSTRUCTIONS = `You answer questions about a scored list of HVAC (SHK) contractors for a sales team.
Answer only from the table. If the table cannot answer the question, say so. Never invent companies, numbers or facts.
Do not recalculate ACV or motions; they are computed by code and given in the table. Cite companies by their exact id.`;

function euro(value: number): string {
  return `€${Math.round(value).toLocaleString("en-US")}`;
}

export function runTable(run: ScoredRun): string {
  const header = `Threshold ${euro(run.threshold)}. ${run.companies.length} companies. Columns: id | name | city | motion | ACV | confidence | technicians | office seats | registered | evidence`;
  const rows = run.companies.map((c) => {
    const evidence = [...c.estimate.technicians.evidence, ...c.estimate.officeSeats.evidence].map((e) => e.finding).join("; ");
    return [
      c.id,
      c.name,
      c.address.city ?? "",
      MOTION_LABELS[c.motion],
      euro(c.estimate.acv),
      c.estimate.confidence,
      c.estimate.technicians.value,
      c.estimate.officeSeats.value,
      c.registeredAt ?? "",
      evidence || "none",
    ].join(" | ");
  });
  return [header, ...rows].join("\n");
}

export async function askRun(
  run: ScoredRun,
  question: string,
  options: { runner?: Runner; cacheRoot?: string } = {},
): Promise<AskAnswer> {
  const q = questionSchema.parse(question);
  const key = hashKey(PROMPT_VERSION, run.generatedAt, run.companies.length, q.toLowerCase());
  const result = await cachedStructured(
    "ask",
    key,
    { schema: askSchema, name: "data_answer", instructions: INSTRUCTIONS, input: `Question: ${q}\n\n${runTable(run)}` },
    options,
  );
  const byId = new Map(run.companies.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const companies = result.value.companies
    .filter((c) => byId.has(c.id) && !seen.has(c.id) && seen.add(c.id))
    .slice(0, 10)
    .map((c) => ({ id: c.id, name: byId.get(c.id)!.name, why: c.why }));
  return { answer: result.value.answer, companies, generatedAt: result.generatedAt, cached: result.cached };
}
