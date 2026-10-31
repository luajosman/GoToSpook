import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FaxxingNotConfiguredError, type FaxRequest, type FaxResult } from "../lib/connectors/faxxing";
import { MemoryFaxLog } from "../lib/fax/log";
import { normalizeFaxNumber } from "../lib/fax/number";
import { offerLetter } from "../lib/fax/offer";
import { sendOffer } from "../lib/fax/send-offer";
import { sampleRun } from "./fixtures/sample";

const WOLFF = "wolff-gebaeudetechnik-10117";
const findCompany = (id: string) => sampleRun.companies.find((c) => c.id === id);

function fakeSend(sent: FaxRequest[]) {
  return async (request: FaxRequest): Promise<FaxResult> => {
    sent.push(request);
    return { provider: "faxxing", id: `fax-${sent.length}`, sentAt: new Date("2026-10-31T12:00:00Z").toISOString() };
  };
}

describe("fax numbers", () => {
  it("normalizes German spellings to E.164", () => {
    assert.equal(normalizeFaxNumber("030 1234567"), "+49301234567");
    assert.equal(normalizeFaxNumber("+49 (0)30 123 45 67"), "+49301234567");
    assert.equal(normalizeFaxNumber("0049 30 1234567"), "+49301234567");
    assert.equal(normalizeFaxNumber("+49 30 / 12 34 56 7"), "+49301234567");
  });

  it("rejects things that are not fax numbers", () => {
    assert.equal(normalizeFaxNumber(""), null);
    assert.equal(normalizeFaxNumber("abc"), null);
    assert.equal(normalizeFaxNumber("12345"), null);
    assert.equal(normalizeFaxNumber("030 12"), null);
  });
});

describe("offer letter", () => {
  it("is German, formal and shows the monthly price", () => {
    const letter = offerLetter(findCompany(WOLFF)!, new Date("2026-10-31T12:00:00Z"));
    assert.match(letter, /Sehr geehrte Damen und Herren/);
    assert.match(letter, /1\.475\s€/);
    assert.match(letter, /35 Monteuren/);
    assert.match(letter, /Sie haben dieses Fax angefordert/);
    assert.doesNotMatch(letter, /\bdu\b|\bdein/i);
  });
});

describe("sendOffer", () => {
  it("rejects a missing consent and a bad number before touching the provider", async () => {
    const sent: FaxRequest[] = [];
    const deps = { findCompany, log: new MemoryFaxLog(), send: fakeSend(sent) };
    const noConsent = await sendOffer({ companyId: WOLFF, faxNumber: "030 1234567", consent: false }, deps);
    assert.equal(noConsent.status, "invalid");
    const badNumber = await sendOffer({ companyId: WOLFF, faxNumber: "hello", consent: true }, deps);
    assert.equal(badNumber.status, "invalid");
    assert.equal(sent.length, 0);
  });

  it("knows unknown companies", async () => {
    const outcome = await sendOffer({ companyId: "nope", faxNumber: "030 1234567", consent: true }, { findCompany, log: new MemoryFaxLog() });
    assert.equal(outcome.status, "unknown_company");
  });

  it("sends once, then rate-limits the same company for an hour", async () => {
    const sent: FaxRequest[] = [];
    let clock = new Date("2026-10-31T12:00:00Z");
    const deps = { findCompany, log: new MemoryFaxLog(), send: fakeSend(sent), now: () => clock };

    const first = await sendOffer({ companyId: WOLFF, faxNumber: "030 1234567", consent: true }, deps);
    assert.equal(first.status, "sent");
    assert.equal(sent[0].to, "+49301234567");
    assert.match(sent[0].subject, /Wolff/);

    clock = new Date("2026-10-31T12:30:00Z");
    const second = await sendOffer({ companyId: WOLFF, faxNumber: "030 1234567", consent: true }, deps);
    assert.equal(second.status, "rate_limited");
    assert.equal(sent.length, 1);

    const other = await sendOffer({ companyId: "klimatechnik-nowak-12681", faxNumber: "030 7654321", consent: true }, deps);
    assert.equal(other.status, "sent");

    clock = new Date("2026-10-31T13:00:01Z");
    const third = await sendOffer({ companyId: WOLFF, faxNumber: "030 1234567", consent: true }, deps);
    assert.equal(third.status, "sent");
    assert.equal(sent.length, 3);
  });

  it("reports a missing Faxxing setup without recording a send", async () => {
    const log = new MemoryFaxLog();
    const deps = {
      findCompany,
      log,
      send: async () => {
        throw new FaxxingNotConfiguredError(["FAXXING_API_KEY", "docs/faxxing.md"]);
      },
    };
    const outcome = await sendOffer({ companyId: WOLFF, faxNumber: "030 1234567", consent: true }, deps);
    assert.equal(outcome.status, "not_configured");
    assert.equal(log.lastSentAt(WOLFF), null);
  });

  it("uses the real connector by default, which refuses until it is configured", async () => {
    delete process.env.FAXXING_API_KEY;
    const outcome = await sendOffer({ companyId: WOLFF, faxNumber: "030 1234567", consent: true }, { findCompany, log: new MemoryFaxLog() });
    assert.equal(outcome.status, "not_configured");
    if (outcome.status === "not_configured") assert.ok(outcome.missing.includes("FAXXING_API_KEY"));
  });
});
