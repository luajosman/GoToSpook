import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { createLushaClient, creditsPerResult, LushaApiError, LushaNotConfiguredError, type LushaClient, type LushaCompany, type ProspectRequest } from "../lib/connectors/lusha";
import { runPipeline } from "../lib/pipeline";
import { scoredRunSchema } from "../lib/schema";
import { legalFormFromName, lushaToScoreInput, staffCount, techniciansFromStaff, websiteOf } from "../lib/sources/lusha";

const roots: string[] = [];
function tempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "acv-lusha-"));
  roots.push(root);
  return root;
}
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

function company(i: number, staff: number | { min: number; max: number } | null = 10 + i): LushaCompany {
  return {
    id: `lusha-${i}`,
    name: `Haustechnik Test ${i} GmbH`,
    domain: `test-${i}.example`,
    employeeCount: staff === null ? null : typeof staff === "number" ? { exact: staff } : staff,
    industry: "Construction",
    location: { city: "Berlin", state: "Berlin", country: "Germany" },
  };
}

describe("mapping a Lusha company", () => {
  it("splits staff with one office seat per 7 technicians", () => {
    assert.equal(techniciansFromStaff(41), 35);
    assert.equal(techniciansFromStaff(21), 18);
    assert.equal(techniciansFromStaff(2), 1);
    assert.equal(techniciansFromStaff(1), 0);
    assert.equal(techniciansFromStaff(0), 0);
  });

  it("reads legal forms and websites from the record", () => {
    assert.equal(legalFormFromName("Wolff Gebäudetechnik GmbH & Co. KG"), "GmbH & Co. KG");
    assert.equal(legalFormFromName("Klimatechnik Nowak GmbH"), "GmbH");
    assert.equal(legalFormFromName("Sanitär Petersen e.K."), "e.K.");
    assert.equal(legalFormFromName("Bad Design Hoffmann UG"), "UG");
    assert.equal(legalFormFromName("Heizung Lindner"), "unknown");
    assert.equal(websiteOf("www.example.de/"), "https://www.example.de");
    assert.equal(websiteOf("https://example.de/team"), "https://example.de");
  });

  it("an exact count gives medium confidence and a staff-based estimate", () => {
    const input = lushaToScoreInput(company(1, 41), "2026-10-31T10:00:00Z")!;
    assert.equal(input.technicians.value, 35);
    assert.equal(input.officeSeats!.value, 6);
    assert.equal(input.technicians.confidence, "medium");
    assert.equal(input.company.sources[0], "lusha");
    assert.equal(input.company.website, "https://test-1.example");
    assert.match(input.technicians.evidence[0].finding, /Lusha lists 41 employees/);
  });

  it("a range gives low confidence and a low–high span", () => {
    const input = lushaToScoreInput(company(2, { min: 11, max: 50 }), "2026-10-31T10:00:00Z")!;
    assert.equal(input.technicians.confidence, "low");
    assert.ok(input.technicians.low < input.technicians.high);
    assert.deepEqual(staffCount(company(2, { min: 11, max: 50 })), { value: 31, low: 11, high: 50, exact: false });
  });

  it("skips companies without a staff count instead of guessing", () => {
    assert.equal(lushaToScoreInput(company(3, null), "2026-10-31T10:00:00Z"), null);
  });
});

describe("Lusha client", () => {
  it("sends the api_key header and the documented body", async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const client = createLushaClient({
      apiKey: "test-key",
      fetchImpl: async (url, init) => {
        seen.push({ url, init });
        return new Response(JSON.stringify({ pagination: { page: 0, size: 25, total: 1 }, results: [company(1)], billing: { creditsCharged: 1 } }));
      },
    });
    const result = await client.prospect({ page: 0, size: 25, include: { keywords: ["Heizung"] } });
    assert.equal(seen[0].url, "https://api.lusha.com/v3/companies/prospecting");
    assert.equal((seen[0].init?.headers as Record<string, string>).api_key, "test-key");
    assert.deepEqual(JSON.parse(String(seen[0].init?.body)), { pagination: { page: 0, size: 25 }, filters: { companies: { include: { keywords: ["Heizung"] } } } });
    assert.equal(result.results[0].id, "lusha-1");
  });

  it("names the problem on 402 and refuses without a key", async () => {
    const client = createLushaClient({ apiKey: "k", maxRetries: 0, fetchImpl: async () => new Response(JSON.stringify({ statusCode: 402, message: "Insufficient credits for this operation" }), { status: 402 }) });
    await assert.rejects(client.usage(), (e: unknown) => e instanceof LushaApiError && e.status === 402 && /Not enough Lusha credits/.test(e.message));
    const saved = process.env.LUSHA_API_KEY;
    delete process.env.LUSHA_API_KEY;
    assert.throws(() => createLushaClient(), LushaNotConfiguredError);
    if (saved) process.env.LUSHA_API_KEY = saved;
  });

  it("reads the live price per result, defaulting to 1", () => {
    assert.equal(creditsPerResult({ pricing: { api_search: { credits: 2, perQuantity: 1 } } }), 2);
    assert.equal(creditsPerResult({}), 1);
  });
});

/** A fake Lusha with `total` companies, 1 credit per result. */
function fakeLusha(total: number, remaining = 1000) {
  const all = Array.from({ length: total }, (_, i) => company(i, 2 + (i % 40)));
  const calls: ProspectRequest[] = [];
  const client: LushaClient = {
    async usage() {
      return { credits: { total: 1000, used: 1000 - remaining, remaining }, pricing: { api_search: { credits: 1, perQuantity: 1 } } };
    },
    async prospect(request) {
      calls.push(request);
      const results = all.slice(request.page * request.size, (request.page + 1) * request.size);
      remaining -= results.length;
      return { pagination: { page: request.page, size: request.size, total }, results, billing: { creditsCharged: results.length, resultsReturned: results.length } };
    },
    async filterValues() {
      return { values: [] };
    },
  };
  return { client, calls };
}

describe("pipeline", () => {
  it("stops at the credit cap, continues next run, and serves cached pages for free", async () => {
    const root = tempRoot();
    const lusha = fakeLusha(60);
    const opts = { client: lusha.client, paths: { dataRoot: root }, pageSize: 25, maxCredits: 50, include: { keywords: ["Heizung"] }, now: () => new Date("2026-10-31T10:00:00Z") };

    const first = await runPipeline(opts);
    assert.equal(first.pagesFetched, 2);
    assert.equal(first.creditsSpent, 50);
    assert.equal(first.stoppedBecause, "cap");
    assert.equal(first.companiesKnown, 50);
    assert.equal(first.companiesScored, 50);

    const second = await runPipeline(opts);
    assert.equal(second.pagesFetched, 1);
    assert.equal(second.creditsSpent, 10);
    assert.equal(second.stoppedBecause, "end_of_results");
    assert.equal(second.newCompanies, 10);
    assert.equal(second.companiesKnown, 60);

    const third = await runPipeline(opts);
    assert.equal(third.pagesFetched, 0);
    assert.equal(third.creditsSpent, 0);
    assert.equal(third.pagesFromCache, 3);
    assert.equal(lusha.calls.length, 3);

    const run = scoredRunSchema.parse(JSON.parse(readFileSync(path.join(root, "results", "scored.json"), "utf8")));
    assert.equal(run.companies.length, 60);
    assert.ok(run.companies.every((c) => c.sources.includes("lusha") && c.motionReason.length > 0));
    assert.equal(run.threshold, run.companies[59].estimate.acv - (run.companies[59].estimate.acv % 100) + (run.companies[59].estimate.acv % 100 >= 50 ? 100 : 0));
  });

  it("refetches expired pages", async () => {
    const root = tempRoot();
    const lusha = fakeLusha(20);
    let now = new Date("2026-10-01T10:00:00Z");
    const opts = { client: lusha.client, paths: { dataRoot: root }, pageSize: 25, maxCredits: 100, cacheDays: 7, now: () => now };
    await runPipeline(opts);
    now = new Date("2026-10-31T10:00:00Z");
    const later = await runPipeline(opts);
    assert.equal(later.pagesFetched, 1);
  });

  it("does not spend when credits are short, and rescoring needs no client", async () => {
    const root = tempRoot();
    const poor = fakeLusha(30, 5);
    const summary = await runPipeline({ client: poor.client, paths: { dataRoot: root }, pageSize: 25, maxCredits: 100 });
    assert.equal(summary.stoppedBecause, "credits");
    assert.equal(poor.calls.length, 0);
    assert.equal(existsSync(path.join(root, "results", "scored.json")), false);

    const rescored = await runPipeline({ client: null, paths: { dataRoot: root } });
    assert.equal(rescored.stoppedBecause, "no_client");
  });
});
