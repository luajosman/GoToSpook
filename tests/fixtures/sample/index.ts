/** The sample run: the sample companies scored with the real formula and motion rules. */
import { config } from "../../../lib/config";
import { scoreCompanies } from "../../../lib/score";
import type { ScoredRun } from "../../../lib/types";
import { SAMPLE_GENERATED_AT, SAMPLE_INPUTS, SAMPLE_THRESHOLD } from "./companies";

const scored = scoreCompanies(SAMPLE_INPUTS, {
  now: new Date(SAMPLE_GENERATED_AT),
  threshold: SAMPLE_THRESHOLD,
});

export const sampleRun: ScoredRun = {
  generatedAt: SAMPLE_GENERATED_AT,
  niche: config.niche,
  threshold: scored.threshold,
  callsPerWeek: scored.callsPerWeek,
  thresholdNote: `set to fit ${scored.callsPerWeek} calls a week`,
  companies: scored.companies,
};
