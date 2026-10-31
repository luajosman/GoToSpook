/**
 * Reads the scored run the pages show: data/results/scored.json, written by the pipeline
 * (`npm run pipeline`). Without it the app shows an empty run; there is no seed data.
 * Synchronous on purpose, so pages can read it during rendering without a cache directive.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "./config";
import { scoredRunSchema } from "./schema";
import type { Motion, ScoredCompany, ScoredRun } from "./types";

export const RESULTS_PATH = path.join(process.cwd(), "data", "results", "scored.json");

export type LoadedRun = ScoredRun & { origin: "file" | "empty"; problem?: string };

export function emptyRun(problem?: string): LoadedRun {
  return {
    generatedAt: new Date(0).toISOString(),
    niche: config.niche,
    threshold: 0,
    callsPerWeek: config.capacity.reps * config.capacity.callsPerRep,
    thresholdNote: "set once the first run is scored",
    companies: [],
    origin: "empty",
    ...(problem ? { problem } : {}),
  };
}

export function loadRun(): LoadedRun {
  if (!existsSync(RESULTS_PATH)) return emptyRun();
  try {
    const parsed = scoredRunSchema.parse(JSON.parse(readFileSync(RESULTS_PATH, "utf8")));
    return { ...parsed, origin: "file" };
  } catch (error) {
    const problem = `data/results/scored.json is not valid: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
    console.warn(`[acv-router] ${problem}`);
    return emptyRun(problem);
  }
}

export function findCompany(run: ScoredRun, id: string): ScoredCompany | undefined {
  return run.companies.find((company) => company.id === id);
}

export function countByMotion(run: ScoredRun): Record<Motion, number> {
  const counts: Record<Motion, number> = { high_touch: 0, automated: 0, welcome: 0, check: 0 };
  for (const company of run.companies) counts[company.motion] += 1;
  return counts;
}
