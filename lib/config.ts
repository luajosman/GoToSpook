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
    source: "SHK guild lists, Needle and Lusha",
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

  /** The other company sources, read on every pipeline run. */
  sources: {
    /** Needle lead list export; only rows in Berlin and Brandenburg unless NEEDLE_ALL_REGIONS=1. */
    needleCsv: process.env.NEEDLE_CSV ?? "data/raw/needle/leads.csv",
    needleAllRegions: process.env.NEEDLE_ALL_REGIONS === "1",
    /** Folder of guild member exports (CSV). */
    guildFolder: process.env.GUILD_FOLDER ?? "data/raw/innung",
    /** Scrape the Fachverband SHK Brandenburg company search (one request per guild, cached). */
    brandenburgShk: process.env.SCRAPE_BRANDENBURG_SHK !== "0",
    scrapeCacheDays: envNumber("SCRAPE_CACHE_DAYS", 7),
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
    /** The threshold never drops below this, in € ACV: a rep's time goes to accounts worth at least this much. */
    minThreshold: envNumber("MIN_THRESHOLD", 6000),
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

  /** LinkedIn messages (Needle) and AI calls (ElevenLabs) from the lead page. */
  outreach: {
    /** The company the outreach is for, as named in messages and calls. */
    sellerName: process.env.OUTREACH_SELLER_NAME ?? "Meisterpfad",
  },

  fax: {
    /** One fax per company per hour. */
    perCompanyWindowMs: 60 * 60 * 1000,
  },
} as const;

export type Config = typeof config;
