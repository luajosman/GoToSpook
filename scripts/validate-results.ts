/**
 * Validate a results file against the schema the app reads, and summarise it.
 *   npm run validate -- data/results/scored.json
 *   npm run validate -- --example     (prints a valid example run)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { RESULTS_PATH } from "../lib/data";
import { sampleRun } from "../lib/sample";
import { scoredRunSchema } from "../lib/schema";
import type { Motion } from "../lib/types";

const arg = process.argv[2];

if (arg === "--example") {
  const example = { ...sampleRun, companies: sampleRun.companies.slice(0, 2) };
  process.stdout.write(JSON.stringify(example, null, 2) + "\n");
  process.exit(0);
}

const file = path.resolve(arg ?? RESULTS_PATH);
let raw: string;
try {
  raw = readFileSync(file, "utf8");
} catch {
  console.error(`Cannot read ${file}`);
  process.exit(2);
}

let json: unknown;
try {
  json = JSON.parse(raw);
} catch (error) {
  console.error(`${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const parsed = scoredRunSchema.safeParse(json);
if (!parsed.success) {
  console.error(`${file} does not match the ScoredRun shape:`);
  for (const issue of parsed.error.issues.slice(0, 40)) {
    console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  if (parsed.error.issues.length > 40) console.error(`  … and ${parsed.error.issues.length - 40} more`);
  process.exit(1);
}

const run = parsed.data;
const counts: Record<Motion, number> = { high_touch: 0, automated: 0, welcome: 0, check: 0 };
const warnings: string[] = [];
const ids = new Set<string>();
for (let i = 0; i < run.companies.length; i++) {
  const c = run.companies[i];
  counts[c.motion] += 1;
  if (ids.has(c.id)) warnings.push(`duplicate id ${c.id}`);
  ids.add(c.id);
  if (c.estimate.acv !== 12 * c.estimate.monthly) warnings.push(`${c.id}: acv ${c.estimate.acv} is not 12 × monthly ${c.estimate.monthly}`);
  if (i > 0 && run.companies[i - 1].estimate.acv < c.estimate.acv) warnings.push(`${c.id}: not sorted by ACV descending`);
  if (c.motion === "high_touch" && c.estimate.acv < run.threshold) warnings.push(`${c.id}: high_touch below the threshold`);
  if (c.motion === "automated" && c.estimate.acv >= run.threshold) warnings.push(`${c.id}: automated at or above the threshold`);
}

console.log(`${file}: valid ScoredRun`);
console.log(`  generated ${run.generatedAt}, niche "${run.niche.label}", threshold €${run.threshold}, ${run.callsPerWeek} calls a week`);
console.log(`  ${run.companies.length} companies: ${counts.high_touch} high_touch, ${counts.check} check, ${counts.automated} automated, ${counts.welcome} welcome`);
if (warnings.length) {
  console.log(`  ${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 20)) console.log(`   - ${w}`);
}
process.exit(0);
