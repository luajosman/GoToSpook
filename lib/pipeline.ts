/**
 * The data pipeline: page through Lusha's company search under a credit cap, keep every
 * company found across runs, score them all and write data/results/scored.json.
 * Search pages are cached, so a rerun only pays for pages it has not seen (or that expired).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { cachePath, hashKey } from "./cache";
import { config } from "./config";
import { creditsPerResult, lushaCompanySchema, prospectResponseSchema, type LushaClient, type LushaCompany, type ProspectResponse } from "./connectors/lusha";
import { scoredRunSchema } from "./schema";
import { scoreCompanies, type ScoreInput } from "./score";
import { scrapeBrandenburgShk } from "./sources/brandenburg-shk";
import { readGuildFolder } from "./sources/innung-folder";
import { lushaToRecord } from "./sources/lusha";
import { readNeedleCsv } from "./sources/needle-csv";
import { enrichMerged, mergeRecords, toScoreInput, type SourceRecord } from "./sources/record";
import type { ScoredRun } from "./types";

export type PipelinePaths = { dataRoot: string };

export function defaultPaths(): PipelinePaths {
  return { dataRoot: path.join(process.cwd(), "data") };
}

const storeSchema = z.record(z.string(), z.object({ company: lushaCompanySchema, fetchedAt: z.string() }));
type Store = z.infer<typeof storeSchema>;

const stateSchema = z.object({ nextPage: z.number().int().min(0), total: z.number().int().min(0).nullable(), lastRunAt: z.string().nullable() });
type State = z.infer<typeof stateSchema>;

const pageEntrySchema = z.object({ storedAt: z.string(), value: prospectResponseSchema });

function readJson<T>(file: string, schema: z.ZodType<T>, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    return schema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export type PipelineOptions = {
  client: LushaClient | null;
  now?: () => Date;
  paths?: PipelinePaths;
  include?: Record<string, unknown>;
  pageSize?: number;
  maxCredits?: number;
  cacheDays?: number;
  log?: (line: string) => void;
  /** Other sources besides Lusha. The directory scrape only runs when asked for explicitly. */
  sources?: {
    needleCsv?: string | false;
    needleAllRegions?: boolean;
    guildFolder?: string | false;
    brandenburgShk?: boolean;
    scrapeCacheDays?: number;
    scrapePauseMs?: number;
    /** Use cached directory pages only, without requests. */
    scrapeOffline?: boolean;
    fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  };
};

export type SourceCounts = { lusha: number; needle: number; needleOutsideNiche: number; needleEnriched: number; guildFiles: number; guildFolder: number; brandenburgShk: number; scrapeErrors: string[] };

export type PipelineSummary = {
  pagesFetched: number;
  pagesFromCache: number;
  creditsSpent: number;
  creditsRemaining: number | null;
  newCompanies: number;
  companiesKnown: number;
  companiesScored: number;
  skipped: number;
  totalInSearch: number | null;
  stoppedBecause: "cap" | "credits" | "end_of_results" | "no_client" | "all_pages_fresh";
  resultsPath: string | null;
  sources: SourceCounts;
};

export async function runPipeline(options: PipelineOptions): Promise<PipelineSummary> {
  const now = options.now ?? (() => new Date());
  const paths = options.paths ?? defaultPaths();
  const include = options.include ?? config.lusha.include;
  const pageSize = Math.min(100, Math.max(10, Math.floor(options.pageSize ?? config.lusha.pageSize)));
  const maxCredits = Math.max(0, options.maxCredits ?? config.lusha.maxCreditsPerRun);
  const cacheMs = (options.cacheDays ?? config.lusha.cacheDays) * 24 * 60 * 60 * 1000;
  const log = options.log ?? (() => {});

  const storeFile = path.join(paths.dataRoot, "raw", "lusha", "companies.json");
  const stateFile = path.join(paths.dataRoot, "state", "lusha.json");
  const cacheRoot = path.join(paths.dataRoot, "cache");
  const searchKey = hashKey("prospecting-1", include, pageSize);

  const store: Store = readJson(storeFile, storeSchema, {});
  const state: State = readJson(stateFile, stateSchema, { nextPage: 0, total: null, lastRunAt: null });
  const knownBefore = Object.keys(store).length;

  const summary: PipelineSummary = {
    pagesFetched: 0,
    pagesFromCache: 0,
    creditsSpent: 0,
    creditsRemaining: null,
    newCompanies: 0,
    companiesKnown: knownBefore,
    companiesScored: 0,
    skipped: 0,
    totalInSearch: state.total,
    stoppedBecause: "no_client",
    resultsPath: null,
    sources: { lusha: 0, needle: 0, needleOutsideNiche: 0, needleEnriched: 0, guildFiles: 0, guildFolder: 0, brandenburgShk: 0, scrapeErrors: [] },
  };

  const addResults = (response: ProspectResponse, fetchedAt: string) => {
    for (const company of response.results) {
      if (!store[company.id]) summary.newCompanies += 1;
      store[company.id] = { company: company as LushaCompany, fetchedAt };
    }
  };

  if (options.client) {
    const usage = await options.client.usage();
    const perResult = creditsPerResult(usage);
    let remaining = usage.credits?.remaining ?? null;
    summary.creditsRemaining = remaining;
    log(`Lusha credits remaining: ${remaining ?? "unknown"}, ${perResult} per result, cap this run: ${maxCredits}`);

    const lastPage = () => (state.total == null ? Number.POSITIVE_INFINITY : Math.max(0, Math.ceil(state.total / pageSize) - 1));
    let page = state.nextPage > lastPage() ? 0 : state.nextPage;
    const visited = new Set<number>();
    summary.stoppedBecause = "all_pages_fresh";

    while (!visited.has(page) && page <= Math.min(1000, lastPage())) {
      visited.add(page);
      const file = cachePath("lusha", `prospecting-${searchKey}-p${page}`, cacheRoot);
      const cached = readJson(file, pageEntrySchema.nullable(), null);
      const fresh = cached && now().getTime() - new Date(cached.storedAt).getTime() < cacheMs;

      let response: ProspectResponse;
      if (fresh) {
        response = cached.value;
        summary.pagesFromCache += 1;
        addResults(response, cached.storedAt);
      } else {
        const cost = pageSize * perResult;
        if (summary.creditsSpent + cost > maxCredits) {
          summary.stoppedBecause = "cap";
          break;
        }
        if (remaining !== null && remaining < cost) {
          summary.stoppedBecause = "credits";
          break;
        }
        response = await options.client.prospect({ page, size: pageSize, include });
        const charged = response.billing?.creditsCharged ?? response.results.length * perResult;
        summary.creditsSpent += charged;
        if (remaining !== null) remaining -= charged;
        summary.pagesFetched += 1;
        const storedAt = now().toISOString();
        writeJson(file, { storedAt, value: response });
        addResults(response, storedAt);
        log(`Page ${page}: ${response.results.length} companies, ${charged} credits`);
      }

      if (typeof response.pagination?.total === "number") state.total = response.pagination.total;
      summary.totalInSearch = state.total;
      if (response.results.length < pageSize) {
        summary.stoppedBecause = "end_of_results";
        state.nextPage = 0;
        break;
      }
      page = page + 1 > lastPage() ? 0 : page + 1;
      state.nextPage = page;
    }
    summary.creditsRemaining = remaining;
    state.lastRunAt = now().toISOString();
    writeJson(storeFile, store);
    writeJson(stateFile, state);
  }

  summary.companiesKnown = Object.keys(store).length;

  const records: SourceRecord[] = [];
  for (const entry of Object.values(store)) {
    const record = lushaToRecord(entry.company as LushaCompany, entry.fetchedAt);
    if (record) records.push(record);
    else summary.skipped += 1;
  }
  summary.sources.lusha = records.length;

  const src = options.sources ?? {};
  const needleFile = src.needleCsv === false ? null : (src.needleCsv ?? path.join(paths.dataRoot, "raw", "needle", "leads.csv"));
  let enrichOnly: SourceRecord[] = [];
  if (needleFile) {
    const needle = readNeedleCsv(needleFile, { allRegions: src.needleAllRegions });
    if (needle) {
      records.push(...needle.records);
      enrichOnly = needle.enrichOnly;
      summary.sources.needle = needle.records.length;
      summary.sources.needleOutsideNiche = needle.outsideNiche;
      log(`Needle CSV: ${needle.records.length} companies in the niche, ${needle.outsideNiche} outside it`);
    }
  }
  const guildDir = src.guildFolder === false ? null : (src.guildFolder ?? path.join(paths.dataRoot, "raw", "innung"));
  if (guildDir) {
    const guilds = readGuildFolder(guildDir);
    records.push(...guilds.records);
    summary.sources.guildFiles = guilds.files;
    summary.sources.guildFolder = guilds.records.length;
    if (guilds.files) log(`Guild exports: ${guilds.records.length} companies from ${guilds.files} file(s)`);
  }
  if (src.brandenburgShk) {
    const scraped = await scrapeBrandenburgShk({
      cacheRoot,
      now: now(),
      cacheDays: src.scrapeCacheDays ?? 7,
      pauseMs: src.scrapePauseMs,
      offline: src.scrapeOffline,
      fetchImpl: src.fetchImpl,
      log,
    });
    records.push(...scraped.records);
    summary.sources.brandenburgShk = scraped.records.length;
    summary.sources.scrapeErrors = scraped.errors;
    log(`SHK directory Brandenburg/Berlin: ${scraped.records.length} companies (${scraped.fetched} guild pages fetched, ${scraped.fromCache} cached)`);
    for (const error of scraped.errors) log(`Directory error: ${error}`);
  }

  const merged = mergeRecords(records);
  if (enrichOnly.length) {
    summary.sources.needleEnriched = enrichMerged(merged, enrichOnly);
    log(`Needle CSV rows outside the niche enriched ${summary.sources.needleEnriched} existing companies`);
  }
  const inputs: ScoreInput[] = [];
  const ids = new Set<string>();
  for (const company of merged) {
    const input = toScoreInput(company);
    let id = input.company.id;
    for (let n = 2; ids.has(id); n++) id = `${input.company.id}-${n}`;
    input.company.id = id;
    ids.add(id);
    inputs.push(input);
  }

  if (inputs.length === 0) {
    log("No companies from any source yet, so nothing was scored.");
    return summary;
  }

  const generatedAt = now();
  const scored = scoreCompanies(inputs, { now: generatedAt, minThreshold: config.capacity.minThreshold });
  const run: ScoredRun = scoredRunSchema.parse({
    generatedAt: generatedAt.toISOString(),
    niche: config.niche,
    threshold: scored.threshold,
    callsPerWeek: scored.callsPerWeek,
    thresholdNote:
      scored.threshold === config.capacity.minThreshold
        ? `the minimum for a rep's time (capacity of ${scored.callsPerWeek} calls a week is not the limit)`
        : `set to fit ${scored.callsPerWeek} calls a week`,
    companies: scored.companies,
  });
  const resultsPath = path.join(paths.dataRoot, "results", "scored.json");
  writeJson(resultsPath, run);
  writeJson(path.join(paths.dataRoot, "results", "runs", `${run.generatedAt.replace(/[:.]/g, "-")}.json`), run);
  summary.companiesScored = run.companies.length;
  summary.resultsPath = resultsPath;
  return summary;
}
