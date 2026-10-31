/** zod schemas for the data files, so a bad data/results/scored.json fails loudly. */
import { z } from "zod";
import type { ScoredRun } from "./types";

export const motionSchema = z.enum(["high_touch", "automated", "welcome", "check"]);
export const confidenceSchema = z.enum(["high", "medium", "low"]);

export const evidenceSchema = z.object({
  source: z.enum(["website", "impressum", "register", "innung", "jobs", "manual"]),
  url: z.string().optional(),
  finding: z.string().min(1),
  fetchedAt: z.string().min(1),
});

export const companySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  legalForm: z.enum(["GmbH", "GmbH & Co. KG", "UG", "e.K.", "sole_trader", "unknown"]),
  address: z.object({
    street: z.string().optional(),
    zip: z.string().optional(),
    city: z.string().optional(),
  }),
  phone: z.string().optional(),
  website: z.string().optional(),
  sources: z.array(z.enum(["innung", "register"])),
  registerId: z.string().optional(),
  registeredAt: z.string().optional(),
  managingDirectors: z.array(z.string()).optional(),
});

export const driverSchema = z.object({
  value: z.number().nonnegative(),
  low: z.number().nonnegative(),
  high: z.number().nonnegative(),
  confidence: confidenceSchema,
  evidence: z.array(evidenceSchema),
});

export const estimateSchema = z.object({
  technicians: driverSchema,
  officeSeats: driverSchema,
  monthly: z.number().nonnegative(),
  acv: z.number().nonnegative(),
  acvLow: z.number().nonnegative(),
  acvHigh: z.number().nonnegative(),
  confidence: confidenceSchema,
});

export const scoredCompanySchema = companySchema.extend({
  estimate: estimateSchema,
  motion: motionSchema,
  motionReason: z.string().min(1),
});

export const scoredRunSchema = z.object({
  generatedAt: z.string().min(1),
  niche: z.object({ id: z.string(), label: z.string(), source: z.string() }),
  threshold: z.number().nonnegative(),
  callsPerWeek: z.number().positive(),
  thresholdNote: z.string(),
  companies: z.array(scoredCompanySchema),
});

/** Keeps the zod output and the hand-written type in step. */
export function asScoredRun(parsed: z.infer<typeof scoredRunSchema>): ScoredRun {
  return parsed;
}
