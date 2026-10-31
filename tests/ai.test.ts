import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { askRun, runTable } from "../lib/ai/ask";
import { briefingFor, cachedBriefing, type Briefing } from "../lib/ai/briefing";
import { AiNotConfiguredError, aiErrorResponse, openAiRunner, type Runner, type StructuredRequest } from "../lib/ai/client";
import { companyFacts } from "../lib/ai/facts";
import { welcomeFor } from "../lib/ai/welcome";
import { sampleRun } from "./fixtures/sample";

const root = mkdtempSync(path.join(tmpdir(), "acv-ai-"));
after(() => rmSync(root, { recursive: true, force: true }));

const brandt = sampleRun.companies.find((c) => c.id === "brandt-soehne-haustechnik-13581")!;
const kraus = sampleRun.companies.find((c) => c.id === "heizungsbau-kraus-13189")!;

/** A fake model that records requests and returns a fixed answer. */
function fake<T>(answer: T) {
  const calls: StructuredRequest<unknown>[] = [];
  const runner: Runner = async <U,>(request: StructuredRequest<U>) => {
    calls.push(request as StructuredRequest<unknown>);
    return request.schema.parse(answer);
  };
  return { runner, calls };
}

const BRIEFING: Briefing = {
  whyNow: "They are hiring two technicians and have a new managing director.",
  talkingPoints: ["Dispatch under pressure", "New decision-maker"],
  openingLineDe: "Guten Tag, ich habe gesehen, dass Sie gerade zwei Anlagenmechaniker suchen.",
  watchOut: "Office headcount comes from one team page.",
};

describe("facts for the model", () => {
  it("carry computed numbers and every evidence line, not the model's", () => {
    const facts = companyFacts(brandt, sampleRun);
    assert.match(facts, /Predicted ACV: €10,200/);
    assert.match(facts, /Monthly price at our pricing: €850/);
    assert.match(facts, /Team page lists 18 field technicians/);
    assert.match(facts, /Motion: High-touch\./);
  });

  it("the ask table has one row per company with its id", () => {
    const table = runTable(sampleRun);
    assert.equal(table.split("\n").length, sampleRun.companies.length + 1);
    assert.match(table, /^brandt-soehne-haustechnik-13581 \| /m);
  });
});

describe("briefing", () => {
  it("asks once, then serves the cache", async () => {
    const model = fake(BRIEFING);
    const first = await briefingFor(brandt, sampleRun, { runner: model.runner, cacheRoot: root });
    assert.equal(first.cached, false);
    assert.equal(first.value.openingLineDe, BRIEFING.openingLineDe);
    const second = await briefingFor(brandt, sampleRun, { runner: model.runner, cacheRoot: root });
    assert.equal(second.cached, true);
    assert.equal(model.calls.length, 1);
    assert.match(model.calls[0].input, /Brandt & Söhne/);
    assert.match(model.calls[0].instructions, /Never invent/);
    assert.deepEqual(cachedBriefing(brandt, root)?.value, BRIEFING);
  });

  it("refresh asks again", async () => {
    const model = fake({ ...BRIEFING, watchOut: "New answer." });
    const result = await briefingFor(brandt, sampleRun, { runner: model.runner, cacheRoot: root, refresh: true });
    assert.equal(result.cached, false);
    assert.equal(result.value.watchOut, "New answer.");
    assert.equal(cachedBriefing(brandt, root)?.value.watchOut, "New answer.");
  });

  it("rejects a malformed model answer", async () => {
    const model = fake({ whyNow: "x" });
    await assert.rejects(briefingFor(kraus, sampleRun, { runner: model.runner, cacheRoot: root }));
    assert.equal(cachedBriefing(kraus, root), null);
  });
});

describe("welcome drafts", () => {
  it("are generated and cached per company", async () => {
    const model = fake({ letterSubjectDe: "Herzlichen Glückwunsch", letterBodyDe: "Sehr geehrte Damen und Herren, …", introRequestDe: "Hallo [Name], …" });
    const result = await welcomeFor(kraus, sampleRun, { runner: model.runner, cacheRoot: root });
    assert.equal(result.value.letterSubjectDe, "Herzlichen Glückwunsch");
    assert.match(model.calls[0].instructions, /opt-out|keine weiteren Briefe/);
  });
});

describe("ask the data", () => {
  it("keeps only companies that exist, once each, with their names", async () => {
    const model = fake({
      answer: "Two high-touch accounts are hiring.",
      companies: [
        { id: "brandt-soehne-haustechnik-13581", why: "2 open roles" },
        { id: "made-up-company", why: "invented" },
        { id: "brandt-soehne-haustechnik-13581", why: "duplicate" },
        { id: "wolff-gebaeudetechnik-10117", why: "4 open roles" },
      ],
    });
    const result = await askRun(sampleRun, "Which high-touch accounts are hiring?", { runner: model.runner, cacheRoot: root });
    assert.deepEqual(result.companies.map((c) => c.id), ["brandt-soehne-haustechnik-13581", "wolff-gebaeudetechnik-10117"]);
    assert.equal(result.companies[1].name, "Wolff Gebäudetechnik GmbH & Co. KG");
    assert.match(model.calls[0].input, /^Question: Which high-touch accounts are hiring\?/);
  });

  it("rejects empty questions before calling the model", async () => {
    const model = fake({ answer: "", companies: [] });
    await assert.rejects(askRun(sampleRun, "  ", { runner: model.runner, cacheRoot: root }));
    assert.equal(model.calls.length, 0);
  });
});

describe("without a key", () => {
  it("the real runner refuses with a clear error that routes turn into 503", async () => {
    const saved = { key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    try {
      await assert.rejects(
        openAiRunner({ schema: (await import("../lib/ai/briefing")).briefingSchema, name: "x", instructions: "x", input: "x" }),
        (error: unknown) => error instanceof AiNotConfiguredError && error.missing.includes("OPENAI_API_KEY"),
      );
      const response = aiErrorResponse(new AiNotConfiguredError(["OPENAI_API_KEY"]));
      assert.equal(response.status, 503);
      assert.equal(response.body.status, "not_configured");
    } finally {
      if (saved.key) process.env.OPENAI_API_KEY = saved.key;
      if (saved.model) process.env.OPENAI_MODEL = saved.model;
    }
  });
});
