# ACV Router, by team GoToSpook

Built at the GTM Hackathon Berlin (Halloween edition). Demo niche: HVAC/SHK contractors in Berlin and Brandenburg.

ACV Router predicts the yearly contract value (ACV) of every company in a niche from public data, then routes it into one of three GTM motions:

- **High-touch:** big accounts get a personal, individual experience from a named rep.
- **Automated:** small established companies find, try and buy on their own.
- **Welcome:** newly registered companies get an early hello and a warm intro through a partner.

## Demo goal (what must work on stage)

1. Load the merged Innung and register list.
2. Show companies enriched and scored, with predicted ACV, confidence and motion.
3. Open a lead: ACV, calculation, evidence with sources.
4. Open a company's personal page and press "Angebot per Fax senden": a real fax arrives via Faxxing.
5. Show the pipeline overview with counts per motion.

Scope is these screens only:
- `/pipeline`: counts per motion and the routing rules
- `/leads`: scored list with a filter by motion
- `/leads/[id]`: detail with estimate, calculation, evidence, motion and next step
- `/p/[slug]`: the company's personal page (German) with the fax button

Everything else (alerts, learning, simulator, explorer) is out of scope today.

## Stack and commands

- Next.js (App Router), TypeScript (strict), Tailwind, zod for validation, the official OpenAI SDK.
- No database: JSON files under `data/` (git-ignored).
- `npm run dev`: start the app.
- `npm run lint`: lint. Run it before every commit.
- `npx tsx scripts/run-pipeline.ts`: pre-run sourcing, enrichment and scoring for all companies and write the results to `data/`.

## Folder structure

```
app/                      pages and route handlers (all API calls happen server-side)
lib/config.ts             pricing, capacity, thresholds, credit budgets
lib/types.ts              shared types (below)
lib/sources/              innung.ts, register.ts, merge.ts
lib/enrich/               needle.ts (fetch website pages), extract.ts (OpenAI)
lib/score/                formula.ts, capacity.ts, motion.ts
lib/connectors/           aiark.ts, blitz.ts, lusha.ts, faxxing.ts, register-api.ts
lib/cache.ts              read and write data/cache/<provider>/<key>.json
scripts/run-pipeline.ts   batch run
docs/                     API docs of every external provider (read before coding a connector)
data/                     git-ignored: raw lists, cache, results
```

## Data model

```ts
type Motion = "high_touch" | "automated" | "welcome" | "check";
type Confidence = "high" | "medium" | "low";

type Evidence = { source: "website" | "impressum" | "register" | "innung" | "jobs" | "manual"; url?: string; finding: string; fetchedAt: string };

type Company = {
  id: string;                 // stable slug from name and zip
  name: string;
  legalForm: "GmbH" | "GmbH & Co. KG" | "UG" | "e.K." | "sole_trader" | "unknown";
  address: { street?: string; zip?: string; city?: string };
  phone?: string;
  website?: string;
  sources: ("innung" | "register")[];
  registerId?: string;        // e.g. "HRB 12345 B", taken from the Impressum when possible
  registeredAt?: string;      // ISO date, from the register
  managingDirectors?: string[];
};

type Driver = { value: number; low: number; high: number; confidence: Confidence; evidence: Evidence[] };

type Estimate = {
  technicians: Driver;
  officeSeats: Driver;
  monthly: number;            // €
  acv: number;                // €, = 12 * monthly
  acvLow: number;
  acvHigh: number;
  confidence: Confidence;
};

type ScoredCompany = Company & { estimate: Estimate; motion: Motion; motionReason: string };
```

## Pipeline

1. **Source:** Innung member list (CSV in `data/raw/`) plus register entries via the register API. Merge and deduplicate by normalized name plus zip code (`lib/sources/merge.ts`). Keep both sources on the record.
2. **Enrich (waterfall, stop when a field is filled):**
   1. Impressum: register number, managing directors, legal form.
   2. Needle reads the website: home, team or "Über uns", careers ("Karriere", "Jobs") and Impressum pages.
   3. OpenAI extracts drivers as JSON validated with zod: technicians and office staff, each with value, low, high, confidence and evidence quotes.
   4. Fallbacks when nothing is found: legal form and missing website mean a small company with low confidence. Never invent numbers.
3. **Score** (`lib/score/formula.ts`), the example customer's pricing:
   - `monthly = 200 + 100 * (officeSeats - 1) + 25 * technicians`
   - `acv = 12 * monthly`; the range comes from the low and high driver values.
   - If office staff is unknown: `officeSeats = 1 + Math.floor(technicians / 7)`.
4. **Threshold** (`lib/score/capacity.ts`): sort by ACV, descending. Calls per week = reps × calls per rep (default 2 × 30 = 60). The threshold is the ACV of company number 60, rounded to €100. Config lives in `lib/config.ts`.
5. **Motion** (`lib/score/motion.ts`), in this order:
   1. Registered in the last 90 days: `welcome`.
   2. Confidence low and ACV within ±25% of the threshold: `check`.
   3. ACV at or above the threshold: `high_touch`.
   4. Otherwise: `automated`.

   Always store a one-sentence `motionReason`.
6. **Motions:**
   - High-touch: contacts from AI Ark (buying group), verified with Blitz. Lusha only for the top accounts (`LUSHA_MAX_ACCOUNTS`, default 20).
   - Automated: personal page plus a letter generated as a PDF (not posted), and fax only on request.
   - Welcome: congratulations letter as a PDF plus a drafted intro request to a partner.

## External tools

Read the matching file in `docs/` before writing any connector. Don't guess endpoints or parameters; if the docs are missing, stop and ask.

| Tool | Job | Env var |
|---|---|---|
| Needle | Fetch and read company websites | `NEEDLE_API_KEY` |
| OpenAI | Extract drivers, write briefings and letters | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Register API | Register details, new registrations | `REGISTER_API_KEY` |
| AI Ark | Buying groups and lookalikes, high-touch only | `AI_ARK_API_KEY` |
| Blitz API | Verify contact details, high-touch only | `BLITZ_API_KEY` |
| Lusha | Company search for the niche (the company list), capped per run; direct numbers for top accounts only | `LUSHA_API_KEY` |
| Faxxing | Send the offer fax, on request only (100 faxes) | `FAXXING_API_KEY` |

## Rules

- Never commit `data/`, `.env.local` or anything holding names, phone numbers or keys. The repo is public.
- Cache every external call in `data/cache/<provider>/<key>.json` and check the cache first. Credits are limited, and reruns during the demo must be instant.
- The model extracts, code calculates. ACV, thresholds and motions are always computed in TypeScript, never by the LLM.
- No cold email, and no unsolicited fax. A fax is only sent after the visitor enters a fax number on `/p/[slug]` and ticks a consent checkbox. Rate-limit the fax route (one per company per hour).
- Every estimate shows its evidence and sources. Missing data lowers the confidence; it is never filled with guesses.
- API keys are only used server-side (route handlers, server actions, scripts). Nothing secret reaches the browser.
- App UI copy is English (for the jury). The personal page, letters and fax are German, addressing the company formally ("Sie").

## Design

- Font Geist (Google Fonts), weights 400, 500 and 600, with tabular numbers for all figures.
- Colors:
  - brand `#0F7B57`, hover `#0B6447`; tint `#EAF6F0` with text `#0B5A40`
  - amber `#E3A008`; tint `#FDF5E1` with text `#8A5A00`
  - ink `#121826`, muted `#5D6676`
  - lines `#E5E8ED` and `#EEF0F3`
  - panels `#F7F8FA`, tracks `#F3F5F8`
- Motions: High-touch green, Automated grey `#C5CCD6`, Welcome amber, Check outlined. Always label motions in text too.
- White page and no cards: sections separated by thin rules. Radius 10px for buttons, inputs and panels; pills for badges. One green primary button per screen.

## Working agreements

- Small steps: build one module at a time, with a quick check (a script or a test with fixture data) before moving on.
- Use the fixtures in `data/raw/sample.csv` (about 20 companies) before running on the full list.
- Don't add dependencies without a reason. Ask before large refactors.
- Commit after each working step with a clear message.
