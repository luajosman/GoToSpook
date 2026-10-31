import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { createCallClient, toConversation, type CallClient } from "../lib/connectors/elevenlabs";
import { createNeedleClient, identityFromUrl, NeedleNotConfiguredError, parseEnrollResult, parseMcpBody, type NeedleClient } from "../lib/connectors/needle";
import { callVariables, enrollInCampaign, OutreachBlockedError, startCall, syncCall, syncNeedleLead } from "../lib/outreach/service";
import { listEvents } from "../lib/outreach/store";
import { sampleRun } from "./fixtures/sample";

const roots: string[] = [];
function root() {
  const r = mkdtempSync(path.join(tmpdir(), "acv-out-"));
  roots.push(r);
  return r;
}
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const company = sampleRun.companies.find((c) => c.id === "brandt-soehne-haustechnik-13581")!;
const person = { identity: "jane-doe-123", name: "Jane Doe", headline: "Geschäftsführerin", profileUrl: "https://www.linkedin.com/in/jane-doe-123/" };

const CAMPAIGN = "00000000-0000-4000-8000-000000000001";
process.env.NEEDLE_CAMPAIGN_ID = CAMPAIGN;

function fakeNeedle(options: { skip?: string; fail?: boolean } = {}) {
  const calls: Array<{ tool: string; args: unknown }> = [];
  const needle: NeedleClient = {
    async searchPeople() {
      return [{ ...person, location: "Berlin", degree: "2" }];
    },
    async getCampaign(id) {
      return { id, name: "SHK outreach", status: "draft" };
    },
    async upsertLead(args) {
      if (options.fail) throw new Error("Needle is down");
      calls.push({ tool: "upsertLead", args });
      return { leadId: "lead-1", created: true };
    },
    async enrollLead(campaignId, leadId) {
      calls.push({ tool: "enrollLead", args: { campaignId, leadId } });
      return options.skip ? { accepted: false, reason: options.skip } : { accepted: true };
    },
    async getLeadEnrollment() {
      return "active";
    },
    async listLeadEvents() {
      return [
        { id: "e2", type: "linkedin_message_sent", label: "Message sent", at: "2026-11-02T09:10:00Z", text: "Guten Tag Frau Doe, …" },
        { id: "e1", type: "linkedin_invitation_sent", label: "Invitation sent", at: "2026-11-01T09:00:00Z" },
        { id: "e0", type: "lead_created", label: "Lead created", at: "2026-10-31T16:00:00Z" },
      ];
    },
  };
  return { needle, calls };
}

function fakeCalls() {
  const started: Array<{ to: string; variables: Record<string, string> }> = [];
  const calls: CallClient = {
    async startCall(input) {
      started.push(input);
      return { conversationId: "conv_1", callSid: "CA1" };
    },
    async getConversation() {
      return { status: "done", durationSecs: 95, summary: "Interested in a demo.", transcript: [{ role: "agent", message: "Hi, this is Lisa, an AI assistant …" }, { role: "user", message: "Sure." }] };
    },
  };
  return { calls, started };
}

describe("Needle connector", () => {
  it("reads JSON-RPC answers from SSE and plain JSON", () => {
    const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\\"hits\\":[]}"}]}}\n\n';
    assert.deepEqual(parseMcpBody(sse), { hits: [] });
    assert.deepEqual(parseMcpBody('{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"plain"}]}}'), { raw: "plain" });
    assert.throws(() => parseMcpBody('data: {"error":{"message":"bad key"}}'), /bad key/);
  });

  it("sends Bearer auth and the tool call, and needs a key and account", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const client = createNeedleClient({
      apiKey: "k",
      accountId: "acc",
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return new Response('data: {"result":{"content":[{"type":"text","text":"{\\"hits\\":[{\\"name\\":\\"Jane Doe\\",\\"profileUrl\\":\\"https://www.linkedin.com/in/jane-doe-123/\\"}]}"}]}}');
      },
    });
    const hits = await client.searchPeople({ keywords: "Brandt", company: "Brandt & Söhne", title: "Geschäftsführer" });
    assert.equal(hits[0].identity, "jane-doe-123");
    const body = JSON.parse(String(seen!.init?.body));
    assert.equal(body.params.name, "needleSearchLinkedinPeopleClassic");
    assert.deepEqual(body.params.arguments.advancedKeywords, { company: "Brandt & Söhne", title: "Geschäftsführer" });
    assert.equal((seen!.init?.headers as Record<string, string>).Authorization, "Bearer k");
    assert.equal(identityFromUrl("https://de.linkedin.com/in/max-mustermann-1a2b/?x=1"), "max-mustermann-1a2b");
    const saved = process.env.NEEDLE_API_KEY;
    delete process.env.NEEDLE_API_KEY;
    assert.throws(() => createNeedleClient({ accountId: "acc" }), NeedleNotConfiguredError);
    if (saved) process.env.NEEDLE_API_KEY = saved;
  });
});

describe("ElevenLabs connector", () => {
  it("posts the outbound call with agent, number and variables", async () => {
    Object.assign(process.env, { ELEVENLABS_API_KEY: "x", ELEVENLABS_AGENT_ID: "agent_1", ELEVENLABS_PHONE_NUMBER_ID: "phnum_1" });
    let body: Record<string, unknown> = {};
    const client = createCallClient({
      fetchImpl: async (url, init) => {
        assert.equal(url, "https://api.elevenlabs.io/v1/convai/twilio/outbound-call");
        body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ success: true, conversation_id: "conv_9", callSid: "CA9" }));
      },
    });
    const started = await client.startCall({ to: "+49301234567", variables: { company_name: "X" } });
    assert.deepEqual(started, { conversationId: "conv_9", callSid: "CA9" });
    assert.equal(body.agent_id, "agent_1");
    assert.equal(body.agent_phone_number_id, "phnum_1");
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_AGENT_ID;
    delete process.env.ELEVENLABS_PHONE_NUMBER_ID;
  });

  it("reads status, duration, summary and transcript from a conversation", () => {
    const c = toConversation({ status: "done", metadata: { call_duration_secs: 61 }, transcript: [{ role: "agent", message: "Hi" }, { role: "user", message: null }], analysis: { transcript_summary: "Short." } });
    assert.deepEqual(c, { status: "done", durationSecs: 61, summary: "Short.", transcript: [{ role: "agent", message: "Hi" }] });
  });
});

describe("LinkedIn through a Needle campaign", () => {
  it("adds the person as a lead, enrolls them, and logs it on the company", async () => {
    const r = root();
    const { needle, calls } = fakeNeedle();
    const event = await enrollInCampaign(company, { person }, { needle, root: r });
    assert.equal(event.status, "enrolled");
    assert.deepEqual(calls.map((c) => c.tool), ["upsertLead", "enrollLead"]);
    const lead = calls[0].args as Record<string, string>;
    assert.equal(lead.linkedin, person.profileUrl);
    assert.equal(lead.firstName, "Jane");
    assert.equal(lead.lastName, "Doe");
    assert.equal(lead.companyName, company.name);
    assert.equal(lead.timezone, "Europe/Berlin");
    assert.deepEqual(calls[1].args, { campaignId: CAMPAIGN, leadId: "lead-1" });
    assert.equal(listEvents(company.id, r)[0].needle?.campaignStatus, "draft");
  });

  it("blocks enrolling the same person twice and reports Needle's skip reason", async () => {
    const r = root();
    await enrollInCampaign(company, { person }, { needle: fakeNeedle().needle, root: r });
    await assert.rejects(enrollInCampaign(company, { person }, { needle: fakeNeedle().needle, root: r }), OutreachBlockedError);
    const other = { ...person, identity: "max-x", name: "Max X", profileUrl: "" };
    await assert.rejects(enrollInCampaign(company, { person: other }, { needle: fakeNeedle({ skip: "recently_contacted" }).needle, root: r }), /recently_contacted/);
    assert.equal(listEvents(company.id, r).at(-1)?.status, "failed");
  });

  it("syncs what Needle sent, oldest first, without the lead_created event", async () => {
    const r = root();
    const { needle } = fakeNeedle();
    const event = await enrollInCampaign(company, { person }, { needle, root: r });
    const synced = await syncNeedleLead(company, event.id, { needle, root: r });
    assert.equal(synced.needle?.enrollment, "active");
    assert.deepEqual(synced.needle?.events?.map((e) => e.type), ["linkedin_invitation_sent", "linkedin_message_sent"]);
    assert.equal(synced.needle?.events?.[1].text, "Guten Tag Frau Doe, …");
  });

  it("needs a campaign id", async () => {
    const saved = process.env.NEEDLE_CAMPAIGN_ID;
    delete process.env.NEEDLE_CAMPAIGN_ID;
    await assert.rejects(enrollInCampaign(company, { person }, { needle: fakeNeedle().needle, root: root() }), NeedleNotConfiguredError);
    process.env.NEEDLE_CAMPAIGN_ID = saved;
  });

  it("reads Needle's enroll answers in their likely shapes", () => {
    assert.deepEqual(parseEnrollResult({ accepted: ["l1"], skipped: [] }, "l1"), { accepted: true });
    assert.deepEqual(parseEnrollResult({ accepted: [], skipped: [{ leadId: "l1", reason: "suppressed" }] }, "l1"), { accepted: false, reason: "suppressed" });
    assert.deepEqual(parseEnrollResult({ results: [{ leadId: "l1", status: "skipped", reason: "missing_identity" }] }, "l1"), { accepted: false, reason: "missing_identity" });
    assert.deepEqual(parseEnrollResult({ results: [{ leadId: "l1", status: "accepted" }] }, "l1"), { accepted: true });
  });
});

describe("AI calls", () => {
  it("starts a call with the company's facts, then stores status and transcript", async () => {
    const r = root();
    const { calls, started } = fakeCalls();
    const event = await startCall(company, { to: "030 1234567", contactName: "Jane Doe" }, { calls, root: r });
    assert.equal(event.status, "initiated");
    assert.equal(started[0].to, "+49301234567");
    assert.equal(started[0].variables.company_name, company.name);
    assert.equal(started[0].variables.contact_name, "Jane Doe");
    const synced = await syncCall(company, event.id, { calls, root: r });
    assert.equal(synced.status, "done");
    assert.equal(synced.call?.durationSecs, 95);
    assert.equal(synced.call?.transcript?.length, 2);
    assert.equal(listEvents(company.id, r)[0].call?.summary, "Interested in a demo.");
  });

  it("allows one call per company per day and rejects bad numbers", async () => {
    const r = root();
    const { calls, started } = fakeCalls();
    await startCall(company, { to: "+49 30 1234567" }, { calls, root: r });
    await assert.rejects(startCall(company, { to: "+49 30 1234567" }, { calls, root: r }), /One call per company per day/);
    await assert.rejects(startCall(company, { to: "hello" }, { calls, root: r }), OutreachBlockedError);
    assert.equal(started.length, 1);
    const tomorrow = () => new Date(Date.now() + 25 * 3600 * 1000);
    await startCall(company, { to: "+49 30 1234567" }, { calls, root: r, now: tomorrow });
    assert.equal(started.length, 2);
  });

  it("fills a default contact when none is given", () => {
    assert.equal(callVariables(company).contact_name, "the owner or managing director");
  });
});
