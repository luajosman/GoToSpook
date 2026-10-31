/**
 * Pricing simulator: re-price every scored company with other prices (and an optional
 * starter plan), keep the threshold fixed so the numbers compare, and show what moves.
 * Pure functions, no React, so the result is checkable.
 */
import type { Confidence, Motion, ScoredCompany } from "../types";
import { monthlyPrice, type Pricing } from "./formula";
import { assignMotion } from "./motion";

export type StarterPlan = { maxTechnicians: number; monthly: number };

export const DEFAULT_STARTER: StarterPlan = { maxTechnicians: 2, monthly: 99 };

/** What the simulator needs per company: small enough to send to the browser. */
export type SimulationInput = {
  id: string;
  name: string;
  technicians: number;
  officeSeats: number;
  confidence: Confidence;
  registeredAt?: string;
  currentAcv: number;
  currentMotion: Motion;
};

export type SimulatedCompany = SimulationInput & {
  newAcv: number;
  newMotion: Motion;
  onStarter: boolean;
};

export type Bucket = { label: string; lo: number; hi: number; current: number; next: number };

export type Simulation = {
  companies: SimulatedCompany[];
  above: { current: { count: number; acv: number }; next: { count: number; acv: number } };
  smallest: { current: number; next: number };
  buckets: Bucket[];
  motionCounts: { current: Record<Motion, number>; next: Record<Motion, number> };
  /** Companies whose motion changes under the new prices, biggest first. */
  moves: SimulatedCompany[];
};

export function toSimulationInput(company: ScoredCompany): SimulationInput {
  const input: SimulationInput = {
    id: company.id,
    name: company.name,
    technicians: company.estimate.technicians.value,
    officeSeats: company.estimate.officeSeats.value,
    confidence: company.estimate.confidence,
    currentAcv: company.estimate.acv,
    currentMotion: company.motion,
  };
  if (company.registeredAt) input.registeredAt = company.registeredAt;
  return input;
}

function emptyCounts(): Record<Motion, number> {
  return { high_touch: 0, automated: 0, welcome: 0, check: 0 };
}

function euro(value: number): string {
  return `€${Math.round(value).toLocaleString("en-US")}`;
}

/** Buckets around the threshold: under half, half to threshold, threshold to double, over double. */
export function bucketsFor(threshold: number): Array<Pick<Bucket, "label" | "lo" | "hi">> {
  const half = threshold / 2;
  const double = threshold * 2;
  return [
    { label: `Under ${euro(half)}`, lo: 0, hi: half },
    { label: `${euro(half)} to ${euro(threshold)}`, lo: half, hi: threshold },
    { label: `${euro(threshold)} to ${euro(double)}`, lo: threshold, hi: double },
    { label: `Over ${euro(double)}`, lo: double, hi: Number.POSITIVE_INFINITY },
  ];
}

export function simulate(
  companies: readonly SimulationInput[],
  pricing: Pricing,
  options: { threshold: number; starter?: StarterPlan | null; now: Date },
): Simulation {
  const { threshold, now } = options;
  const starter = options.starter ?? null;

  const simulated: SimulatedCompany[] = companies.map((c) => {
    const onStarter = starter !== null && c.technicians <= starter.maxTechnicians;
    const monthly = onStarter ? starter.monthly : monthlyPrice(c.technicians, c.officeSeats, pricing);
    const newAcv = pricing.monthsPerYear * monthly;
    const { motion } = assignMotion({ registeredAt: c.registeredAt }, { acv: newAcv, confidence: c.confidence }, threshold, now);
    return { ...c, newAcv, newMotion: motion, onStarter };
  });

  const aboveCurrent = simulated.filter((c) => c.currentAcv >= threshold);
  const aboveNext = simulated.filter((c) => c.newAcv >= threshold);
  const sum = (list: SimulatedCompany[], pick: (c: SimulatedCompany) => number) => list.reduce((acc, c) => acc + pick(c), 0);

  const buckets: Bucket[] = bucketsFor(threshold).map((b) => ({
    ...b,
    current: simulated.filter((c) => c.currentAcv >= b.lo && c.currentAcv < b.hi).length,
    next: simulated.filter((c) => c.newAcv >= b.lo && c.newAcv < b.hi).length,
  }));

  const motionCounts = { current: emptyCounts(), next: emptyCounts() };
  for (const c of simulated) {
    motionCounts.current[c.currentMotion] += 1;
    motionCounts.next[c.newMotion] += 1;
  }

  const moves = simulated.filter((c) => c.newMotion !== c.currentMotion).sort((a, b) => b.newAcv - a.newAcv);

  return {
    companies: simulated,
    above: {
      current: { count: aboveCurrent.length, acv: sum(aboveCurrent, (c) => c.currentAcv) },
      next: { count: aboveNext.length, acv: sum(aboveNext, (c) => c.newAcv) },
    },
    smallest: {
      current: simulated.length ? Math.min(...simulated.map((c) => c.currentAcv)) : 0,
      next: simulated.length ? Math.min(...simulated.map((c) => c.newAcv)) : 0,
    },
    buckets,
    motionCounts,
    moves,
  };
}
