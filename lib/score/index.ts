/**
 * Score a list of companies: estimates from the drivers, the threshold from capacity,
 * then a motion with a reason for every company. Sorted by ACV, descending.
 */
import type { Company, Driver, ScoredCompany } from "../types";
import { callsPerWeek, thresholdFor } from "./capacity";
import { estimateFromDrivers } from "./formula";
import { assignMotion } from "./motion";

export type ScoreInput = {
  company: Company;
  technicians: Driver;
  /** Leave out when office staff is unknown; the formula then derives it. */
  officeSeats?: Driver;
};

export type ScoreOptions = {
  now: Date;
  /** Fixed threshold instead of the one computed from capacity (e.g. for a partial list). */
  threshold?: number;
  calls?: number;
};

export type ScoreResult = {
  threshold: number;
  callsPerWeek: number;
  companies: ScoredCompany[];
};

export function scoreCompanies(inputs: readonly ScoreInput[], options: ScoreOptions): ScoreResult {
  const calls = options.calls ?? callsPerWeek();
  const estimated = inputs.map((input) => ({
    company: input.company,
    estimate: estimateFromDrivers(input.technicians, input.officeSeats),
  }));
  const threshold =
    options.threshold ?? thresholdFor(estimated.map((e) => e.estimate.acv), calls);

  const companies: ScoredCompany[] = estimated
    .map(({ company, estimate }) => ({
      ...company,
      estimate,
      ...assignMotion(company, estimate, threshold, options.now),
    }))
    .sort((a, b) => b.estimate.acv - a.estimate.acv);

  return { threshold, callsPerWeek: calls, companies };
}
