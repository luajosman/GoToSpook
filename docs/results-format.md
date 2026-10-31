# Results file: what the pipeline hands to the app

The app reads one file: **`data/results/scored.json`** (git-ignored). When it exists and validates, every screen uses it; otherwise the committed sample shows with a "Sample data" badge. No database, no API between pipeline and app.

Check a file before handing it over:

```bash
npm run validate -- data/results/scored.json
```

It prints what fails (zod errors with paths) or a summary with counts per motion. For a valid example to copy from:

```bash
npx tsx scripts/validate-results.ts --example > example-run.json
```

## Shape

The TypeScript types are in `lib/types.ts`, the zod schema in `lib/schema.ts`. The file is a `ScoredRun`:

```jsonc
{
  "generatedAt": "2026-10-31T09:00:00+01:00",   // ISO; motions were decided relative to this time
  "niche": { "id": "hvac-berlin-brandenburg", "label": "HVAC contractors in Berlin and Brandenburg", "source": "SHK guild export, Berlin" },
  "threshold": 6000,                            // € ACV that separates high_touch from automated
  "callsPerWeek": 60,                           // reps × calls per rep
  "thresholdNote": "set to fit 60 calls a week",
  "companies": [ /* ScoredCompany, sorted by estimate.acv descending */ ]
}
```

Each company:

```jsonc
{
  "id": "wolff-gebaeudetechnik-10117",          // stable slug from name and zip: companyId(name, zip) in lib/slug.ts
  "name": "Wolff Gebäudetechnik GmbH & Co. KG",
  "legalForm": "GmbH & Co. KG",                 // "GmbH" | "GmbH & Co. KG" | "UG" | "e.K." | "sole_trader" | "unknown"
  "address": { "street": "…", "zip": "10117", "city": "Berlin-Mitte" },   // all optional
  "phone": "+49…",                              // optional, never committed anywhere
  "website": "https://…",                       // optional
  "sources": ["innung", "register"],            // where the record came from
  "registerId": "HRA 50001 B",                  // optional
  "registeredAt": "2009-03-12",                 // optional ISO date; drives the welcome rule
  "managingDirectors": ["…"],                   // optional
  "estimate": {
    "technicians":  { "value": 35, "low": 33, "high": 37, "confidence": "high", "evidence": [ /* Evidence */ ] },
    "officeSeats":  { "value": 5,  "low": 4,  "high": 6,  "confidence": "high", "evidence": [ /* Evidence */ ] },
    "monthly": 1475, "acv": 17700, "acvLow": 16800, "acvHigh": 18600,
    "confidence": "high"                        // the weaker of the two drivers
  },
  "motion": "high_touch",                       // "high_touch" | "automated" | "welcome" | "check"
  "motionReason": "Predicted ACV of €17,700 is at or above the €6,000 threshold, so a named rep owns the account."
}
```

Evidence, one per finding:

```jsonc
{ "source": "website", "url": "https://…/team", "finding": "Team page lists 18 field technicians and 3 office staff", "fetchedAt": "2026-10-25T08:00:00+02:00" }
// source: "website" | "impressum" | "register" | "innung" | "jobs" | "manual"; url optional
```

## Let the code do the maths

Don't compute `monthly`, `acv`, `threshold` or `motion` in the pipeline. Build one `ScoreInput` per company (the record plus the two drivers; leave `officeSeats` out when office staff is unknown, the formula derives it) and call the existing scorer, which returns the sorted, scored list with threshold and reasons:

```ts
import { scoreCompanies } from "./lib/score";       // or "@/lib/score" inside the app
import type { ScoredRun } from "./lib/types";

const result = scoreCompanies(inputs, { now: new Date() });   // threshold from capacity in lib/config.ts
const run: ScoredRun = {
  generatedAt: new Date().toISOString(),
  niche: config.niche,
  threshold: result.threshold,
  callsPerWeek: result.callsPerWeek,
  thresholdNote: `set to fit ${result.callsPerWeek} calls a week`,
  companies: result.companies,
};
```

`lib/pipeline.ts` does exactly this with Lusha data; `tests/fixtures/sample/index.ts` does it on fixture inputs.

## Rules that still apply
- Keys only in `.env.local`, read server-side. Cache every external call under `data/cache/<provider>/<key>.json` and check it first.
- Never invent numbers: a missing driver stays unknown (derived office seats, low confidence) rather than guessed.
- Nothing under `data/` is committed. The repo is public.
