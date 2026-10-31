/**
 * Read-only check of the outreach setup: lists the Needle LinkedIn accounts and campaigns and the ElevenLabs agents
 * and phone numbers, and says which configured ids match. Sends no message and places no call.
 *   npm run outreach:check
 */
import { ELEVENLABS_BASE_URL } from "../lib/connectors/elevenlabs";
import { NEEDLE_MCP_URL, parseMcpBody } from "../lib/connectors/needle";

try {
  process.loadEnvFile(".env.local");
} catch {
  // reported below
}

const ok = (s: string) => console.log(`  ✓ ${s}`);
const bad = (s: string) => console.log(`  ✗ ${s}`);
let problems = 0;

async function needle() {
  console.log("Needle (LinkedIn)");
  const key = process.env.NEEDLE_API_KEY;
  if (!key) {
    bad("NEEDLE_API_KEY missing");
    problems++;
    return;
  }
  const response = await fetch(NEEDLE_MCP_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "needleListConnectedAccounts", arguments: {} } }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) {
    bad(`Needle answered ${response.status}: ${text.slice(0, 160)}`);
    problems++;
    return;
  }
  const accounts = ((parseMcpBody(text) as { connectedAccounts?: Array<Record<string, unknown>> }).connectedAccounts ?? []).filter((a) => String(a.channel ?? "").toLowerCase().includes("linkedin"));
  if (accounts.length === 0) {
    bad("No LinkedIn account is connected in Needle");
    problems++;
    return;
  }
  for (const a of accounts) console.log(`    account ${a.id}: ${a.status}${a.canUse ? ", usable" : ", not usable"}`);
  const configured = process.env.NEEDLE_CONNECTED_ACCOUNT_ID;
  const match = accounts.find((a) => a.id === configured);
  if (match?.canUse) ok("NEEDLE_CONNECTED_ACCOUNT_ID matches a usable LinkedIn account");
  else {
    bad(configured ? "NEEDLE_CONNECTED_ACCOUNT_ID does not match a usable account" : "NEEDLE_CONNECTED_ACCOUNT_ID missing");
    const usable = accounts.filter((a) => a.canUse);
    if (usable.length === 1) console.log(`    suggestion: NEEDLE_CONNECTED_ACCOUNT_ID=${usable[0].id}`);
    problems++;
  }

  const campaignsBody = await fetch(NEEDLE_MCP_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "needleListCampaigns", arguments: { limit: 50 } } }),
    signal: AbortSignal.timeout(30_000),
  }).then((r) => r.text());
  const campaigns = ((parseMcpBody(campaignsBody) as { campaigns?: Array<{ id?: string; name?: string; status?: string }> }).campaigns ?? []).filter((c) => c.status !== "archived");
  for (const c of campaigns) console.log(`    campaign ${c.id}: ${c.name} (${c.status})`);
  const campaign = campaigns.find((c) => c.id === process.env.NEEDLE_CAMPAIGN_ID);
  if (campaign) {
    ok(`NEEDLE_CAMPAIGN_ID matches "${campaign.name}"`);
    if (campaign.status !== "active") console.log(`    note: the campaign is ${campaign.status}; Needle sends nothing until it is active`);
  } else {
    bad(process.env.NEEDLE_CAMPAIGN_ID ? "NEEDLE_CAMPAIGN_ID does not match a campaign" : "NEEDLE_CAMPAIGN_ID missing");
    if (campaigns.length === 1) console.log(`    suggestion: NEEDLE_CAMPAIGN_ID=${campaigns[0].id}`);
    problems++;
  }
}

async function elevenlabs() {
  console.log("ElevenLabs (calls)");
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    bad("ELEVENLABS_API_KEY missing");
    problems++;
    return;
  }
  const get = async (path: string) => {
    const response = await fetch(`${ELEVENLABS_BASE_URL}${path}`, { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(30_000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`ElevenLabs answered ${response.status} for ${path}: ${text.slice(0, 160)}`);
    return JSON.parse(text) as unknown;
  };

  const phones = (await get("/convai/phone-numbers")) as Array<{ phone_number_id?: string; phone_number?: string; label?: string; provider?: string }>;
  for (const p of phones) console.log(`    number ${p.phone_number_id}: ${p.phone_number ?? "?"} (${p.provider ?? "?"}${p.label ? `, ${p.label}` : ""})`);
  const phoneId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if (phones.some((p) => p.phone_number_id === phoneId)) ok("ELEVENLABS_PHONE_NUMBER_ID matches an imported number");
  else {
    bad(phoneId ? "ELEVENLABS_PHONE_NUMBER_ID does not match an imported number" : "ELEVENLABS_PHONE_NUMBER_ID missing");
    if (phones.length === 1) console.log(`    suggestion: ELEVENLABS_PHONE_NUMBER_ID=${phones[0].phone_number_id}`);
    if (phones.length === 0) console.log("    no number imported yet: import the Twilio number with cold_call.py import-phone");
    problems++;
  }

  const agents = ((await get("/convai/agents")) as { agents?: Array<{ agent_id?: string; name?: string }> }).agents ?? [];
  for (const a of agents) console.log(`    agent ${a.agent_id}: ${a.name}`);
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const agent = agents.find((a) => a.agent_id === agentId);
  if (agent) ok(`ELEVENLABS_AGENT_ID matches "${agent.name}"`);
  else {
    bad(agentId ? "ELEVENLABS_AGENT_ID does not match an agent" : "ELEVENLABS_AGENT_ID missing (run npm run calls:setup-agent)");
    problems++;
  }
}

async function main() {
  for (const step of [needle, elevenlabs]) {
    try {
      await step();
    } catch (error) {
      bad(error instanceof Error ? error.message : String(error));
      problems++;
    }
  }
  console.log(problems === 0 ? "\nOutreach is ready. Nothing was sent." : `\n${problems} problem(s). Nothing was sent.`);
  process.exit(problems === 0 ? 0 : 1);
}

void main();
