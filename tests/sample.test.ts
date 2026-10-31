import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sampleRun } from "../lib/sample";
import { scoredRunSchema } from "../lib/schema";
import type { Motion } from "../lib/types";

const EXPECTED: Record<string, { acv: number; motion: Motion }> = {
  "wolff-gebaeudetechnik-10117": { acv: 17700, motion: "high_touch" },
  "klimatechnik-nowak-12681": { acv: 13200, motion: "high_touch" },
  "brandt-soehne-haustechnik-13581": { acv: 10200, motion: "high_touch" },
  "krause-waerme-bad-13187": { acv: 6900, motion: "high_touch" },
  "haustechnik-yildiz-12043": { acv: 6000, motion: "check" },
  "meyer-haustechnik-10585": { acv: 5400, motion: "automated" },
  "waermetechnik-lorenz-partner-14467": { acv: 3900, motion: "welcome" },
  "sanitaer-petersen-12163": { acv: 3600, motion: "automated" },
  "heizung-lindner-12555": { acv: 3000, motion: "automated" },
  "heizungsbau-kraus-13189": { acv: 3000, motion: "welcome" },
  "baeder-waerme-schulz-13403": { acv: 2700, motion: "automated" },
  "kaeltetechnik-arslan-12099": { acv: 2700, motion: "automated" },
};

describe("sample run", () => {
  it("scores every sample company as the mockup shows", () => {
    assert.equal(sampleRun.threshold, 6000);
    assert.equal(sampleRun.companies.length, Object.keys(EXPECTED).length);
    for (const company of sampleRun.companies) {
      const expected = EXPECTED[company.id];
      assert.ok(expected, `unexpected company id ${company.id}`);
      assert.equal(company.estimate.acv, expected.acv, company.name);
      assert.equal(company.motion, expected.motion, `${company.name}: ${company.motionReason}`);
    }
  });

  it("is sorted by ACV, descending", () => {
    const acvs = sampleRun.companies.map((c) => c.estimate.acv);
    assert.deepEqual(acvs, [...acvs].sort((a, b) => b - a));
  });

  it("round-trips through JSON and the zod schema, as a results file would", () => {
    const parsed = scoredRunSchema.parse(JSON.parse(JSON.stringify(sampleRun)));
    assert.equal(parsed.companies.length, sampleRun.companies.length);
  });

  it("holds no phone numbers or managing directors", () => {
    for (const company of sampleRun.companies) {
      assert.equal(company.phone, undefined);
      assert.equal(company.managingDirectors, undefined);
      if (company.website) assert.match(company.website, /\.example$/);
    }
  });
});
