/**
 * Imports a phone number into ElevenLabs as the calls' caller number (POST /v1/convai/phone-numbers,
 * provider twilio). A number not bought from Twilio, like a German mobile number, must first be a
 * Verified Caller ID in Twilio; ElevenLabs then uses it for outbound calls only.
 *   npm run calls:import-number -- 01571234567
 *   npm run calls:import-number -- +491571234567 --write   (also sets ELEVENLABS_PHONE_NUMBER_ID in .env.local)
 * Needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env.local.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ELEVENLABS_BASE_URL } from "../lib/connectors/elevenlabs";
import { normalizeFaxNumber } from "../lib/fax/number";

try {
  process.loadEnvFile(".env.local");
} catch {
  // reported below
}

async function main() {
  const raw = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const write = process.argv.includes("--write");
  const number = raw ? normalizeFaxNumber(raw) : null;
  if (!number) {
    console.error("Usage: npm run calls:import-number -- <phone number> [--write]");
    process.exit(2);
  }
  const missing = ["ELEVENLABS_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing in .env.local: ${missing.join(", ")}`);
    process.exit(1);
  }
  const response = await fetch(`${ELEVENLABS_BASE_URL}/convai/phone-numbers`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "twilio",
      phone_number: number,
      label: `Outbound caller ${number}`,
      sid: process.env.TWILIO_ACCOUNT_SID,
      token: process.env.TWILIO_AUTH_TOKEN,
      enable_sms: false,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`ElevenLabs answered ${response.status}: ${text.slice(0, 300)}`);
    console.error("If it says the number does not exist in Twilio: verify it under Twilio Console > Phone Numbers > Verified Caller IDs first.");
    process.exit(1);
  }
  const id = (JSON.parse(text) as { phone_number_id?: string }).phone_number_id;
  if (!id) {
    console.error(`No phone_number_id in the answer: ${text.slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`Imported ${number} as ${id}.`);
  if (write) {
    const env = readFileSync(".env.local", "utf8");
    const next = /^ELEVENLABS_PHONE_NUMBER_ID=.*$/m.test(env)
      ? env.replace(/^ELEVENLABS_PHONE_NUMBER_ID=.*$/m, `ELEVENLABS_PHONE_NUMBER_ID=${id}`)
      : `${env.replace(/\n?$/, "\n")}ELEVENLABS_PHONE_NUMBER_ID=${id}\n`;
    writeFileSync(".env.local", next);
    console.log("ELEVENLABS_PHONE_NUMBER_ID updated in .env.local. Restart npm run dev.");
  } else {
    console.log(`Set ELEVENLABS_PHONE_NUMBER_ID=${id} in .env.local to call from this number.`);
  }
}

void main();
