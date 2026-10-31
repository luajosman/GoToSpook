/**
 * Shared types of the ACV Router. The shapes follow the data model in CLAUDE.md;
 * only ScoredRun (the file the pipeline writes and the pages read) is added here.
 */

export type Motion = "high_touch" | "automated" | "welcome" | "check";
export type Confidence = "high" | "medium" | "low";

export type EvidenceSource =
  | "website"
  | "impressum"
  | "register"
  | "innung"
  | "lusha"
  | "jobs"
  | "manual";

export type Evidence = {
  source: EvidenceSource;
  url?: string;
  finding: string;
  /** ISO timestamp of when the source was read. */
  fetchedAt: string;
};

export type LegalForm =
  | "GmbH"
  | "GmbH & Co. KG"
  | "UG"
  | "e.K."
  | "sole_trader"
  | "unknown";

export type CompanySource = "innung" | "register" | "lusha";

export type Company = {
  /** Stable slug from name and zip, also used as the personal-page slug. */
  id: string;
  name: string;
  legalForm: LegalForm;
  address: { street?: string; zip?: string; city?: string };
  phone?: string;
  website?: string;
  sources: CompanySource[];
  /** e.g. "HRB 12345 B", taken from the Impressum when possible. */
  registerId?: string;
  /** ISO date, from the register. */
  registeredAt?: string;
  managingDirectors?: string[];
};

export type Driver = {
  value: number;
  low: number;
  high: number;
  confidence: Confidence;
  evidence: Evidence[];
};

export type Estimate = {
  technicians: Driver;
  officeSeats: Driver;
  /** € per month */
  monthly: number;
  /** € per year, = 12 * monthly */
  acv: number;
  acvLow: number;
  acvHigh: number;
  confidence: Confidence;
};

export type ScoredCompany = Company & {
  estimate: Estimate;
  motion: Motion;
  /** One sentence that explains the motion. */
  motionReason: string;
};

/** One scored batch: what `scripts/run-pipeline.ts` writes to data/results/scored.json. */
export type ScoredRun = {
  /** ISO timestamp of the run; motions were decided relative to it. */
  generatedAt: string;
  niche: { id: string; label: string; source: string };
  /** ACV threshold in € that separates high-touch from automated. */
  threshold: number;
  callsPerWeek: number;
  /** How the threshold was set, in one sentence. */
  thresholdNote: string;
  /** Sorted by predicted ACV, descending. */
  companies: ScoredCompany[];
};
