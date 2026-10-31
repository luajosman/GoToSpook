/**
 * Pricing, capacity, routing thresholds and credit budgets. Everything that turns
 * drivers into money and money into a motion is computed in TypeScript from these values.
 */

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  niche: {
    id: "hvac-berlin-brandenburg",
    label: "HVAC contractors in Berlin and Brandenburg",
    /** Where the company list came from, as shown in breadcrumbs. */
    source: "SHK guild export, Berlin",
  },

  /** The example customer's pricing, € per month. */
  pricing: {
    basePerMonth: 200,
    perExtraOfficeSeat: 100,
    perTechnician: 25,
    monthsPerYear: 12,
    /** When office staff is unknown: officeSeats = 1 + floor(technicians / this). */
    techniciansPerOfficeSeat: 7,
  },

  /** Rep capacity sets the high-touch threshold. */
  capacity: {
    reps: 2,
    callsPerRep: 30,
    /** The threshold is rounded to this step, in €. */
    thresholdRounding: 100,
    /** First names of the reps, for display only. */
    repNames: ["Lena", "Tom"],
  },

  routing: {
    /** Registered within this many days: welcome. */
    welcomeDays: 90,
    /** Low confidence and ACV within ± this share of the threshold: check. */
    checkBand: 0.25,
  },

  /** Credit budgets of the external tools. */
  budgets: {
    lushaMaxAccounts: envNumber("LUSHA_MAX_ACCOUNTS", 20),
    lushaCredits: 150,
    faxes: 100,
  },

  fax: {
    /** One fax per company per hour. */
    perCompanyWindowMs: 60 * 60 * 1000,
  },
} as const;

export type Config = typeof config;
