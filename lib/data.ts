/**
 * Reads the scored run the pages show: data/results/scored.json when the pipeline has
 * written one, otherwise the committed sample. Synchronous on purpose, so pages can read
 * it during rendering without a cache directive.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { sampleRun } from "./sample";
import { scoredRunSchema } from "./schema";
import type { Motion, ScoredCompany, ScoredRun } from "./types";

export const RESULTS_PATH = path.join(process.cwd(), "data", "results", "scored.json");

export type LoadedRun = ScoredRun & { origin: "file" | "sample" };

export function loadRun(): LoadedRun {
  if (existsSync(RESULTS_PATH)) {
    try {
      const parsed = scoredRunSchema.parse(JSON.parse(readFileSync(RESULTS_PATH, "utf8")));
      return { ...parsed, origin: "file" };
    } catch (error) {
      console.warn(
        `[acv-router] Ignoring ${RESULTS_PATH} and showing the sample: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return { ...sampleRun, origin: "sample" };
}

export function findCompany(run: ScoredRun, id: string): ScoredCompany | undefined {
  return run.companies.find((company) => company.id === id);
}

export function countByMotion(run: ScoredRun): Record<Motion, number> {
  const counts: Record<Motion, number> = { high_touch: 0, automated: 0, welcome: 0, check: 0 };
  for (const company of run.companies) counts[company.motion] += 1;
  return counts;
}
