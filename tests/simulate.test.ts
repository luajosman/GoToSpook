import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CURRENT_PRICING, monthlyPrice, pricingFormulaText } from "../lib/score/formula";
import { bucketsFor, DEFAULT_STARTER, simulate, toSimulationInput } from "../lib/score/simulate";
import { sampleRun } from "./fixtures/sample";

const NOW = new Date(sampleRun.generatedAt);
const inputs = sampleRun.companies.map(toSimulationInput);
const threshold = sampleRun.threshold;

describe("pricing argument", () => {
  it("defaults to the config and accepts other prices", () => {
    assert.equal(monthlyPrice(35, 5), 1475);
    assert.equal(monthlyPrice(35, 5, { ...CURRENT_PRICING, basePerMonth: 300 }), 1575);
    assert.equal(monthlyPrice(6, 2, { basePerMonth: 150, perExtraOfficeSeat: 50, perTechnician: 30, monthsPerYear: 12 }), 380);
    assert.match(pricingFormulaText({ ...CURRENT_PRICING, perTechnician: 30 }), /€30 × field techs/);
  });
});

describe("simulate", () => {
  it("changes nothing at the current prices", () => {
    const result = simulate(inputs, CURRENT_PRICING, { threshold, now: NOW });
    assert.equal(result.moves.length, 0);
    assert.equal(result.above.current.count, result.above.next.count);
    assert.equal(result.above.current.count, 5);
    assert.deepEqual(result.motionCounts.current, result.motionCounts.next);
    for (const c of result.companies) assert.equal(c.newAcv, c.currentAcv);
  });

  it("buckets sit around the threshold and cover every company", () => {
    const labels = bucketsFor(6000).map((b) => b.label);
    assert.deepEqual(labels, ["Under €3,000", "€3,000 to €6,000", "€6,000 to €12,000", "Over €12,000"]);
    const result = simulate(inputs, CURRENT_PRICING, { threshold, now: NOW });
    const total = result.buckets.reduce((acc, b) => acc + b.next, 0);
    assert.equal(total, inputs.length);
  });

  it("a higher base price pushes companies over the fixed threshold", () => {
    const result = simulate(inputs, { ...CURRENT_PRICING, basePerMonth: 300 }, { threshold, now: NOW });
    assert.equal(result.above.next.count, 6);
    const meyer = result.companies.find((c) => c.id === "meyer-haustechnik-10585")!;
    assert.equal(meyer.currentAcv, 5400);
    assert.equal(meyer.newAcv, 6600);
    assert.equal(meyer.newMotion, "high_touch");
    assert.ok(result.moves.some((c) => c.id === meyer.id));
    assert.ok(result.above.next.acv > result.above.current.acv);
  });

  it("keeps welcome companies welcome and low-confidence ones in check", () => {
    const result = simulate(inputs, { ...CURRENT_PRICING, basePerMonth: 400 }, { threshold, now: NOW });
    const kraus = result.companies.find((c) => c.id === "heizungsbau-kraus-13189")!;
    assert.equal(kraus.newMotion, "welcome");
    const yildiz = result.companies.find((c) => c.id === "haustechnik-yildiz-12043")!;
    assert.equal(yildiz.newAcv, 8400);
    assert.equal(yildiz.newMotion, "high_touch", "€8,400 is outside the ±25% band, so no longer check");
  });

  it("a starter plan caps small companies at €99 a month", () => {
    const result = simulate(inputs, CURRENT_PRICING, { threshold, now: NOW, starter: DEFAULT_STARTER });
    assert.equal(result.smallest.current, 2700);
    assert.equal(result.smallest.next, 1188);
    const onStarter = result.companies.filter((c) => c.onStarter);
    assert.ok(onStarter.every((c) => c.technicians <= 2 && c.newAcv === 1188));
    assert.ok(result.companies.filter((c) => c.technicians > 2).every((c) => !c.onStarter));
  });
});
