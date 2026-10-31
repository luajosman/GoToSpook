# GoToSpook: ACV Router

Predicts the yearly contract value (ACV) of every company in a niche from public data and routes it into the right GTM motion: **High-touch**, **Automated** or **Welcome**. Built at the GTM Hackathon Berlin (Halloween edition), starting with HVAC/SHK contractors in Berlin and Brandenburg.

The model extracts, the code calculates: team size comes from public pages, the price, the threshold and the motion are computed in TypeScript and every estimate shows its evidence.

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The header has Overview, Pipeline, Leads and Customers; How it works and Pricing sit in the footer.

| Route | What it shows |
|---|---|
| `/` | Overview: totals, companies by motion, biggest accounts, data quality |
| `/pipeline` | A board with one column per motion, biggest companies first |
| `/leads` | Every scored company with predicted ACV, confidence and motion; filter with `?motion=high_touch` etc. |
| `/leads/[id]` | One company: estimate, calculation, evidence with sources, motion and next step |
| `/p/[slug]` | The company's personal page in German, with "Angebot per Fax senden" |
| `/pricing` | Pricing simulator: change the three prices or add a starter plan and see who moves, on the loaded run |
| `/customers` | Customers who are growing, shown as an empty state until a customer list exists |
| `/how-it-works` | The three motions, routing rules, data sources and contact rules |

Companies come from the SHK guild directory for Brandenburg, the Needle lead list, guild exports and Lusha's company search (see `docs/sources.md`). Without a results file the app is empty and the Overview explains how to start the pipeline; there is no seed data. A run writes `data/results/scored.json` (git-ignored), which the app picks up on the next page load. The file's contract for whoever writes the pipeline is in `docs/results-format.md`.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the app |
| `npm run lint` | ESLint; run it before every commit |
| `npm run check` | Unit checks for the formula, threshold, motion rules, sample data and fax flow |
| `npm run typecheck` | Route types plus `tsc --noEmit` |
| `npm run pipeline` | One Lusha run: fetch new search pages under the credit cap, score everything, write `data/results/scored.json` |
| `npm run pipeline:watch` | The same, repeated every `LUSHA_WATCH_MINUTES` (default 60); `-- --every 30 --max-credits 20` to override |
| `npm run pipeline -- --rescore` | Score what is stored without calling Lusha |
| `npm run lusha:filters -- locations Berlin` | Look up valid Lusha filter values for `lib/config.ts` |
| `npm run calls:setup-agent` | Create the English calling agent on ElevenLabs and print its id |
| `npm run validate -- <file>` | Check a results file against the schema the app reads (`npx tsx scripts/validate-results.ts --example` prints one) |

## Data pipeline

Sources and how they are merged: `docs/sources.md`. Without a Lusha key the pipeline runs on the other sources.

### Lusha

1. Put `LUSHA_API_KEY` into `.env.local`.
2. Check the location values once: `npm run lusha:filters -- locations Berlin` and `… Brandenburg`, and adjust `config.lusha.include` in `lib/config.ts` if Lusha spells them differently.
3. `npm run pipeline` for one run, or `npm run pipeline:watch` to keep it running.

Each run reads the remaining credits and the live price first, spends at most `LUSHA_MAX_CREDITS_PER_RUN` (default 50), continues where the last run stopped, and serves cached pages (`LUSHA_CACHE_DAYS`, default 7) for free. Every company found is kept in `data/raw/lusha/` and the whole list is re-scored on each run; each run is also saved under `data/results/runs/`. Lusha gives total staff; the code splits it into technicians and office seats with the brief's ratio of one office seat per 7 technicians. Companies without a staff count are skipped, never guessed. Endpoints and open questions: `docs/lusha.md`.

The pages read the results file on each request in `npm run dev`. A production build (`npm run build`) prerenders most pages, so rebuild after a run when you deploy.

## Outreach

Each lead page has a LinkedIn button (find a person at the company, draft with AI, send a connection request or message through Needle) and a phone button (an English AI agent calls through ElevenLabs). Both need a confirm click, and the message or the call transcript is saved on the lead. Setup and the legal points to check first: `docs/outreach.md`.

## AI features

Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env.local`, then restart `npm run dev`.

- **Briefing** on every lead page: why contact now, talking points, a German opening line and what to watch out for.
- **Welcome drafts** on new companies: a German congratulations letter and an intro request to a partner.
- **Ask the data** on the Overview: questions about the scored companies, answered with the companies they rest on.

Answers are generated on demand, written only from the scored data, and cached in `data/cache/openai/`. Prices, ACV and motions always come from the scoring code. Details in `docs/openai.md`.

## How scoring works

- `monthly = 200 + 100 × (officeSeats − 1) + 25 × technicians`, `acv = 12 × monthly` (`lib/score/formula.ts`)
- Unknown office staff: `officeSeats = 1 + floor(technicians / 7)`, and the confidence drops
- Threshold: the ACV of company number reps × calls per rep (2 × 30 = 60) in the list sorted by ACV, rounded to €100 (`lib/score/capacity.ts`)
- Motion, in this order: registered in the last 90 days → **welcome**; low confidence within ±25% of the threshold → **check**; at or above the threshold → **high_touch**; otherwise **automated**. Every company carries a one-sentence `motionReason` (`lib/score/motion.ts`)

Pricing, capacity and budgets live in `lib/config.ts`; the types in `lib/types.ts`.

## Fax flow

`POST /api/fax` with `{ companyId, faxNumber, consent: true }`. The body is validated with zod, consent is required, and each company gets at most one fax per hour (`lib/fax/`). The letter is German and formal. The Faxxing connector (`lib/connectors/faxxing.ts`) refuses with "Faxxing not configured" until `docs/faxxing.md` and `FAXXING_API_KEY` exist; its HTTP call is written from the docs, not guessed.

## Not built yet

Sourcing (`lib/sources/`), enrichment with Needle and OpenAI (`lib/enrich/`), the register, AI Ark, Blitz and Lusha connectors, the cache (`lib/cache.ts`) and the batch script. Each needs the provider's docs in `docs/` first; see `docs/README.md`.

## Rules

The repo is public. `data/`, `.env.local`, keys, real names and phone numbers are never committed. See `CLAUDE.md` for the full brief.
