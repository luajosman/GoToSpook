# GoToSpook: ACV Router

Predicts the yearly contract value (ACV) of every company in a niche from public data and routes it into the right GTM motion: **High-touch**, **Automated** or **Welcome**. Built at the GTM Hackathon Berlin (Halloween edition), starting with HVAC/SHK contractors in Berlin and Brandenburg.

The model extracts, the code calculates: team size comes from public pages, the price, the threshold and the motion are computed in TypeScript and every estimate shows its evidence.

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

| Route | What it shows |
|---|---|
| `/pipeline` | Counts per motion, the three motions and the routing rules |
| `/leads` | Every scored company with predicted ACV, confidence and motion; filter with `?motion=high_touch` etc. |
| `/leads/[id]` | One company: estimate, calculation, evidence with sources, motion and next step |
| `/p/[slug]` | The company's personal page in German, with "Angebot per Fax senden" |
| `/pricing` | Pricing simulator: change the three prices or add a starter plan and see who moves, on the loaded run |
| `/inbound` | Live inbound scoring, shown as an empty feed until a form or Meta lead source is connected |
| `/customers` | Customers who are growing, shown as an empty state until a customer list exists |

Without a results file the app shows the committed sample (twelve fictional companies from the design mockup, marked "Sample data"). A real run goes to `data/results/scored.json`, which is git-ignored and picked up automatically.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the app |
| `npm run lint` | ESLint; run it before every commit |
| `npm run check` | Unit checks for the formula, threshold, motion rules, sample data and fax flow |
| `npm run typecheck` | Route types plus `tsc --noEmit` |
| `npm run pipeline` | Source, enrich and score all companies into `data/` (not built yet) |

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
