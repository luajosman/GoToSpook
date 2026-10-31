import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { thresholdFor, callsPerWeek, roundTo } from "../lib/score/capacity";
import { estimateFromDrivers, monthlyPrice, officeSeatsFallback, officeSeatsFromTechnicians } from "../lib/score/formula";
import { assignMotion, MOTION_ORDER } from "../lib/score/motion";
import { scoreCompanies, type ScoreInput } from "../lib/score";
import type { Company, Driver, Estimate } from "../lib/types";
import { companyId } from "../lib/slug";

const NOW = new Date("2026-10-31T10:00:00Z");

function driver(value: number, confidence: Driver["confidence"] = "high", low = value, high = value): Driver {
  return { value, low, high, confidence, evidence: [] };
}

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: "test-co-10115",
    name: "Test Co",
    legalForm: "GmbH",
    address: { zip: "10115", city: "Berlin" },
    sources: ["innung"],
    ...overrides,
  };
}

function estimateOf(acv: number, confidence: Estimate["confidence"] = "high"): Estimate {
  return {
    technicians: driver(0),
    officeSeats: driver(1),
    monthly: acv / 12,
    acv,
    acvLow: acv,
    acvHigh: acv,
    confidence,
  };
}

describe("formula", () => {
  it("prices the example customer's plan", () => {
    assert.equal(monthlyPrice(35, 5), 1475);
    assert.equal(monthlyPrice(18, 3), 850);
    assert.equal(monthlyPrice(1, 1), 225);
    assert.equal(monthlyPrice(0, 1), 200);
  });

  it("never charges less than one office seat", () => {
    assert.equal(monthlyPrice(4, 0), 300);
  });

  it("derives office seats from technicians when unknown", () => {
    assert.equal(officeSeatsFallback(0), 1);
    assert.equal(officeSeatsFallback(6), 1);
    assert.equal(officeSeatsFallback(7), 2);
    assert.equal(officeSeatsFallback(18), 3);
    const seats = officeSeatsFromTechnicians(driver(18, "high", 16, 20));
    assert.deepEqual([seats.value, seats.low, seats.high, seats.confidence], [3, 3, 3, "low"]);
  });

  it("builds an estimate with acv = 12 * monthly and a range from low and high", () => {
    const estimate = estimateFromDrivers(driver(18, "high", 16, 20), driver(3, "medium", 2, 4));
    assert.equal(estimate.monthly, 850);
    assert.equal(estimate.acv, 10200);
    assert.equal(estimate.acvLow, 12 * (200 + 100 + 400));
    assert.equal(estimate.acvHigh, 12 * (200 + 300 + 500));
    assert.equal(estimate.confidence, "medium");
  });

  it("lowers the confidence to the weakest driver", () => {
    const estimate = estimateFromDrivers(driver(8, "low", 6, 10));
    assert.equal(estimate.confidence, "low");
    assert.equal(estimate.officeSeats.value, 2);
  });
});

describe("capacity", () => {
  it("defaults to 2 reps × 30 calls", () => {
    assert.equal(callsPerWeek(), 60);
  });

  it("takes the ACV of company number 60 and rounds to €100", () => {
    const acvs = Array.from({ length: 70 }, (_, i) => 20000 - i * 137); // descending
    const expected = roundTo(acvs[59], 100);
    assert.equal(thresholdFor([...acvs].reverse()), expected);
    assert.equal(expected % 100, 0);
  });

  it("uses the last company when the list is shorter than the capacity", () => {
    assert.equal(thresholdFor([17700, 13200, 2740]), 2700);
    assert.equal(thresholdFor([]), 0);
  });

  it("rounds half up", () => {
    assert.equal(roundTo(6049, 100), 6000);
    assert.equal(roundTo(6050, 100), 6100);
  });
});

describe("motion", () => {
  const threshold = 6000;

  it("checks the rules in the order welcome, check, high_touch, automated", () => {
    assert.deepEqual([...MOTION_ORDER], ["welcome", "check", "high_touch", "automated"]);
  });

  it("welcomes companies registered in the last 90 days, whatever their size", () => {
    const result = assignMotion(company({ registeredAt: "2026-10-12" }), estimateOf(17700), threshold, NOW);
    assert.equal(result.motion, "welcome");
    assert.match(result.motionReason, /19 days ago/);
  });

  it("does not welcome companies registered more than 90 days ago", () => {
    const result = assignMotion(company({ registeredAt: "2026-07-01" }), estimateOf(17700), threshold, NOW);
    assert.equal(result.motion, "high_touch");
  });

  it("sends low confidence near the threshold to check", () => {
    assert.equal(assignMotion(company(), estimateOf(6000, "low"), threshold, NOW).motion, "check");
    assert.equal(assignMotion(company(), estimateOf(4500, "low"), threshold, NOW).motion, "check");
    assert.equal(assignMotion(company(), estimateOf(7500, "low"), threshold, NOW).motion, "check");
    assert.equal(assignMotion(company(), estimateOf(4499, "low"), threshold, NOW).motion, "automated");
    assert.equal(assignMotion(company(), estimateOf(7501, "low"), threshold, NOW).motion, "high_touch");
    assert.equal(assignMotion(company(), estimateOf(6000, "medium"), threshold, NOW).motion, "high_touch");
  });

  it("routes at or above the threshold to high_touch, below to automated", () => {
    assert.equal(assignMotion(company(), estimateOf(6000), threshold, NOW).motion, "high_touch");
    assert.equal(assignMotion(company(), estimateOf(5999), threshold, NOW).motion, "automated");
  });

  it("always gives a one-sentence reason", () => {
    for (const acv of [17700, 6000, 2700]) {
      for (const confidence of ["high", "low"] as const) {
        const { motionReason } = assignMotion(company(), estimateOf(acv, confidence), threshold, NOW);
        assert.ok(motionReason.length > 20);
        assert.ok(motionReason.endsWith("."));
      }
    }
  });
});

describe("scoreCompanies", () => {
  it("sorts by ACV, sets the threshold from capacity and a motion for everyone", () => {
    const inputs: ScoreInput[] = Array.from({ length: 65 }, (_, i) => ({
      company: company({ id: `co-${i}`, name: `Co ${i}` }),
      technicians: driver(1 + i),
      officeSeats: driver(1 + Math.floor(i / 10)),
    }));
    const result = scoreCompanies(inputs, { now: NOW });
    assert.equal(result.companies.length, 65);
    assert.equal(result.callsPerWeek, 60);
    for (let i = 1; i < result.companies.length; i++) {
      assert.ok(result.companies[i - 1].estimate.acv >= result.companies[i].estimate.acv);
    }
    assert.equal(result.threshold, roundTo(result.companies[59].estimate.acv, 100));
    assert.ok(result.companies.every((c) => c.motionReason.length > 0));
    const highTouch = result.companies.filter((c) => c.motion === "high_touch").length;
    assert.ok(highTouch >= 59 && highTouch <= 61, `high-touch count ${highTouch}`);
  });

  it("accepts a fixed threshold for a partial list", () => {
    const result = scoreCompanies(
      [{ company: company(), technicians: driver(35), officeSeats: driver(5) }],
      { now: NOW, threshold: 6000 },
    );
    assert.equal(result.threshold, 6000);
    assert.equal(result.companies[0].motion, "high_touch");
  });
});

describe("companyId", () => {
  it("drops the legal form and transliterates umlauts", () => {
    assert.equal(companyId("Wolff Gebäudetechnik GmbH & Co. KG", "10117"), "wolff-gebaeudetechnik-10117");
    assert.equal(companyId("Haustechnik Yıldız GmbH", "12043"), "haustechnik-yildiz-12043");
    assert.equal(companyId("Sanitär Petersen e.K.", "12163"), "sanitaer-petersen-12163");
    assert.equal(companyId("Brandt & Söhne Haustechnik GmbH"), "brandt-soehne-haustechnik");
  });
});
