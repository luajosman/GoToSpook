/**
 * Capacity sets the threshold: sort by ACV descending, calls per week = reps × calls per rep,
 * the threshold is the ACV of the company at that position, rounded to €100.
 */
import { config } from "../config";

export function callsPerWeek(): number {
  return config.capacity.reps * config.capacity.callsPerRep;
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * The ACV of company number `calls` in the list sorted by ACV descending, rounded.
 * With fewer companies than calls, every company fits, so the last one sets the threshold.
 */
export function thresholdFor(acvs: readonly number[], calls: number = callsPerWeek()): number {
  if (acvs.length === 0 || calls < 1) return 0;
  const sorted = [...acvs].sort((a, b) => b - a);
  const index = Math.min(Math.floor(calls), sorted.length) - 1;
  return roundTo(sorted[index], config.capacity.thresholdRounding);
}
