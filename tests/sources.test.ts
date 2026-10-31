import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { runPipeline } from "../lib/pipeline";
import { entriesToRecords, parseResults, scrapeBrandenburgShk } from "../lib/sources/brandenburg-shk";
import { csvObjects, parseCsv } from "../lib/sources/csv";
import { guildRowsToRecords } from "../lib/sources/innung-folder";
import { needleRowsToRecords } from "../lib/sources/needle-csv";
import { fallbackStaff, mergeRecords, toScoreInput, type SourceRecord } from "../lib/sources/record";
import { inNiche } from "../lib/sources/regions";

const roots: string[] = [];
function tempRoot() {
  const r = mkdtempSync(path.join(tmpdir(), "acv-src-"));
  roots.push(r);
  return r;
}
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const T = "2026-10-31T10:00:00Z";

describe("csv", () => {
  it("handles quotes, commas, line breaks and semicolon exports", () => {
    assert.deepEqual(parseCsv('a,b\n"x, y","line\nbreak"\n"say ""hi""",2\n'), [["a", "b"], ["x, y", "line\nbreak"], ['say "hi"', "2"]]);
    assert.deepEqual(csvObjects("Firma;PLZ\nMuster GmbH;14467\n"), [{ Firma: "Muster GmbH", PLZ: "14467" }]);
  });
});

describe("regions", () => {
  it("knows Berlin and Brandenburg by state, town or postcode", () => {
    assert.equal(inNiche({ state: "Berlin" }), true);
    assert.equal(inNiche({ city: "Potsdam" }), true);
    assert.equal(inNiche({ city: "Berlin-Spandau" }), true);
    assert.equal(inNiche({ zip: "03046" }), true);
    assert.equal(inNiche({ zip: "80331" }), false);
    assert.equal(inNiche({ state: "Bavaria", city: "München" }), false);
  });
});

const NEEDLE = [
  "Company Name,Company Domain,First Name,Last Name,Job Title,Email,Phone,Fax,LinkedIn,Timezone,City,State,Country,Country Code,Location,Employee Headcount,Sub-Industry,Trade Focus,Description,Lusha ID",
  'Test Wärme GmbH,test-waerme.example,Erika,Muster,Inhaber,,,,https://www.linkedin.com/company/test-waerme,,Berlin,Berlin,Germany,DE,"Berlin, Germany",41,HVAC,HVAC / Klimatechnik,"Heating, plumbing",L-1',
  "Süd Klima AG,sued.example,,,,,,,https://www.linkedin.com/company/sued,,München,Bavaria,Germany,DE,,12,HVAC,HVAC,,L-2",
].join("\n");

describe("Needle CSV", () => {
  it("keeps companies in the niche with headcount, domain and LinkedIn page, and no person data", () => {
    const { records, outsideNiche } = needleRowsToRecords(NEEDLE, { fetchedAt: T });
    assert.equal(records.length, 1);
    assert.equal(outsideNiche, 1);
    const r = records[0];
    assert.equal(r.name, "Test Wärme GmbH");
    assert.equal(r.staff?.value, 41);
    assert.equal(r.website, "https://test-waerme.example");
    assert.equal(r.linkedinUrl, "https://www.linkedin.com/company/test-waerme");
    assert.equal(r.lushaId, "L-1");
    assert.doesNotMatch(JSON.stringify(r), /Erika|Muster/);
    assert.equal(needleRowsToRecords(NEEDLE, { fetchedAt: T, allRegions: true }).records.length, 2);
  });
});

describe("guild exports", () => {
  it("reads German column names", () => {
    const records = guildRowsToRecords("Firma;Straße;PLZ;Ort;Telefon;Website\nMuster Haustechnik e.K.;Hauptstr. 1;14467;Potsdam;0331 123456;www.muster.example\n", "Innung Potsdam", T);
    assert.equal(records.length, 1);
    assert.deepEqual(records[0].address, { street: "Hauptstr. 1", zip: "14467", city: "Potsdam" });
    assert.equal(records[0].legalForm, "e.K.");
    assert.equal(records[0].phone, "0331 123456");
    assert.equal(records[0].guild, "Innung Potsdam");
  });
});

const PAGE = `<ul>
<li class="list-group-item inner" data-company-lat="52.4" data-company-lon="13.1" data-loop-count="0" data-company-title="Alpha Heizung &amp; Sanitär GmbH" data-company-postal-code="14476" data-company-city="Potsdam">
  <div class="ms-2"><h5 class="no-margin"><a href="/de/firmensuche/firma/101/alpha/">Alpha Heizung &amp; Sanitär GmbH</a></h5>
  <p class="small mb-0">Musterweg 5<br />14476 Potsdam</p></div></li>
<li class="list-group-item inner" data-company-title="Beta Bad" data-company-postal-code="03046" data-company-city="Cottbus">
  <h5><a href="/de/firmensuche/firma/102/beta/">Beta Bad</a></h5><p class="small mb-0">Ring 2<br />03046 Cottbus</p></li>
</ul>`;

describe("SHK directory Brandenburg", () => {
  it("parses name, street, postcode and city from the result list", () => {
    assert.deepEqual(parseResults(PAGE), [
      { id: "101", name: "Alpha Heizung & Sanitär GmbH", street: "Musterweg 5", zip: "14476", city: "Potsdam" },
      { id: "102", name: "Beta Bad", street: "Ring 2", zip: "03046", city: "Cottbus" },
    ]);
    const records = entriesToRecords(parseResults(PAGE), "Innung Potsdam", T);
    assert.equal(records[0].source, "innung");
    assert.equal(records[0].legalForm, "GmbH");
  });

  it("does GET then POST per guild, caches, and makes no request offline", async () => {
    const root = tempRoot();
    const calls: string[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if ((init?.method ?? "GET") === "GET") {
        return new Response('<input name="csrfmiddlewaretoken" value="tok">', { headers: { "set-cookie": "csrftoken=abc; Path=/" } });
      }
      assert.match(String(init?.body), /innung=96/);
      assert.equal((init?.headers as Record<string, string>).Cookie, "csrftoken=abc");
      return new Response(PAGE);
    };
    const now = new Date(T);
    const first = await scrapeBrandenburgShk({ cacheRoot: root, now, cacheDays: 7, pauseMs: 0, guilds: ["96"], fetchImpl });
    assert.equal(first.records.length, 2);
    assert.deepEqual(calls, ["GET https://www.brandenburg-shk.de/de/firmensuche/", "POST https://www.brandenburg-shk.de/de/firmensuche/"]);
    const cached = await scrapeBrandenburgShk({ cacheRoot: root, now, cacheDays: 7, pauseMs: 0, guilds: ["96"], fetchImpl });
    assert.equal(cached.fromCache, 1);
    const offline = await scrapeBrandenburgShk({ cacheRoot: root, now: new Date("2027-01-01"), cacheDays: 7, pauseMs: 0, guilds: ["96"], fetchImpl, offline: true });
    assert.equal(offline.records.length, 2);
    assert.equal(calls.length, 2);
  });
});

describe("merge and fallback", () => {
  const needle: SourceRecord = { source: "needle", name: "Alpha Heizung & Sanitär GmbH", address: { city: "Potsdam" }, website: "https://alpha.example", staff: { value: 21, low: 21, high: 21, exact: true }, evidence: [] };
  const guild: SourceRecord = { source: "innung", name: "Alpha Heizung und Sanitär GmbH", address: { street: "Musterweg 5", zip: "14476", city: "Potsdam" }, guild: "Innung Potsdam", evidence: [] };

  it("merges the same company from two sources and keeps the best fields", () => {
    const merged = mergeRecords([guild, needle]);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].sources, ["innung", "needle"]);
    assert.equal(merged[0].address.street, "Musterweg 5");
    assert.equal(merged[0].staff?.value, 21);
    assert.equal(merged[0].website, "https://alpha.example");
  });

  it("estimates unmeasured companies as small, with low confidence and a stated reason", () => {
    const input = toScoreInput(mergeRecords([guild])[0]);
    assert.equal(input.technicians.confidence, "low");
    assert.deepEqual(fallbackStaff("GmbH", false), { value: 4, low: 2, high: 8, exact: false });
    assert.match(input.technicians.evidence.at(-1)!.finding, /No team size in any source/);
    assert.equal(input.company.id, "alpha-heizung-und-sanitaer-14476");
  });
});

describe("pipeline with all sources", () => {
  it("merges Needle, a guild export and the directory, and keeps small unmeasured companies out of High-touch", async () => {
    const root = tempRoot();
    mkdirSync(path.join(root, "raw", "needle"), { recursive: true });
    mkdirSync(path.join(root, "raw", "innung"), { recursive: true });
    writeFileSync(path.join(root, "raw", "needle", "leads.csv"), NEEDLE);
    writeFileSync(path.join(root, "raw", "innung", "Innung_Potsdam.csv"), "Firma;PLZ;Ort\nGamma SHK GmbH;14467;Potsdam\n");
    const fetchImpl = async (_url: string, init?: RequestInit) =>
      (init?.method ?? "GET") === "GET" ? new Response('<input name="csrfmiddlewaretoken" value="t">', { headers: { "set-cookie": "csrftoken=x" } }) : new Response(PAGE);
    const summary = await runPipeline({ client: null, paths: { dataRoot: root }, sources: { brandenburgShk: true, scrapePauseMs: 0, fetchImpl } });
    assert.equal(summary.sources.needle, 1);
    assert.equal(summary.sources.guildFolder, 1);
    assert.ok(summary.sources.brandenburgShk >= 2);
    assert.equal(summary.companiesScored, 4);
  });
});
