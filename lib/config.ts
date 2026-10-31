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
    source: "Lusha company search",
  },

  /** Lusha company search: what to look for and how much to spend per run (see docs/lusha.md). */
  lusha: {
    /** filters.companies.include for POST /v3/companies/prospecting. Check values with `npm run lusha:filters -- locations Berlin`. */
    include: {
      locations: [
        { country: "Germany", state: "Berlin" },
        { country: "Germany", state: "Brandenburg" },
      ],
      keywords: ["Heizung", "Sanitär", "SHK", "Haustechnik", "Klimatechnik", "Wärmepumpe"],
    } as Record<string, unknown>,
    /** Results per page (Lusha allows 10–100). */
    pageSize: envNumber("LUSHA_PAGE_SIZE", 25),
    /** Credits one pipeline run may spend at most. */
    maxCreditsPerRun: envNumber("LUSHA_MAX_CREDITS_PER_RUN", 50),
    /** A cached search page is fetched again after this many days. */
    cacheDays: envNumber("LUSHA_CACHE_DAYS", 7),
    /** Minutes between runs in watch mode. */
    watchMinutes: envNumber("LUSHA_WATCH_MINUTES", 60),
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
