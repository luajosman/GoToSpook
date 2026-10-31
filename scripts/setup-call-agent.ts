/**
 * Creates the English calling agent on ElevenLabs (same endpoint as elevenlabs/cold_call.py create-agent)
 * and prints its id for ELEVENLABS_AGENT_ID. The agent says up front that it is an AI and that the call
 * is recorded and transcribed, and ends the call politely if the person objects.
 *   npm run calls:setup-agent
 */
import { config } from "../lib/config";
import { ELEVENLABS_BASE_URL } from "../lib/connectors/elevenlabs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // reported below
}

const PROMPT = `You are Lisa, an AI assistant making a short business call on behalf of {{seller_name}}. {{seller_name}} makes back-office software for HVAC, plumbing and heating trade businesses (SHK) in Germany: quotes, technician scheduling, tender documents and invoicing.

## Rules that always apply
- You are an AI. Say so at the start (the first message does) and never claim or imply to be human.
- The call is recorded and transcribed. If the person objects to that, or says they are not interested, or asks not to be called again: apologise, confirm that they will not be called again, thank them and end the call.
- Speak English. If the person clearly prefers German, apologise that you can only speak English and offer to have a colleague follow up in writing.
- Never invent facts about their company. You only know: {{company_name}} in {{city}}, roughly {{technician_count}} technicians (an estimate from public data that may be wrong).
- Keep turns to one or two sentences. Keep the whole call under three minutes. Never be pushy.

## Goal
Reach {{contact_name}} at {{company_name}}. Ask one question about how they handle quotes and technician scheduling today. If it sounds relevant, offer a 15-minute screen-share demo next Tuesday or Thursday and ask for the best email for the invite. If they are busy, offer to send a one-page summary instead.

## Pricing questions
Plans depend on the number of technicians and office seats. Offer to send the exact price for their team by email.`;

const FIRST_MESSAGE =
  "Hi, this is Lisa, an AI assistant calling on behalf of {{seller_name}}. Just so you know, this call is recorded and transcribed. Am I speaking with someone from {{company_name}}, and do you have two minutes?";

async function main() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    console.error("ELEVENLABS_API_KEY missing in .env.local.");
    process.exit(1);
  }
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
  const response = await fetch(`${ELEVENLABS_BASE_URL}/convai/agents/create`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `ACV Router – ${config.outreach.sellerName} intro call (English)`,
      conversation_config: {
        agent: { prompt: { prompt: PROMPT }, first_message: FIRST_MESSAGE, language: "en" },
        tts: { voice_id: voiceId },
      },
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`ElevenLabs answered ${response.status}: ${text.slice(0, 300)}`);
    process.exit(1);
  }
  const agentId = (JSON.parse(text) as { agent_id?: string }).agent_id;
  console.log(`Agent created. Add this line to .env.local:\nELEVENLABS_AGENT_ID=${agentId}`);
}

void main();
