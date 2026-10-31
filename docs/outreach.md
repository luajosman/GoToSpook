# Outreach: LinkedIn (Needle) and AI calls (ElevenLabs)

The LinkedIn and phone buttons on a lead page start one action for that one company, after a person confirms it in a dialog. Every action is saved on the lead (Outreach section): LinkedIn messages with their text, calls with status, duration, summary and transcript. The log lives in `data/outreach/<company-id>.json`, which is git-ignored because it holds personal data.

Both connectors are TypeScript ports of the team's Python scripts (`needle/linkedin_outreach.py`, `elevenlabs/cold_call.py`) and call exactly the endpoints those scripts use.

## Setup (`.env.local`)

| Variable | Where it comes from |
|---|---|
| `NEEDLE_API_KEY` | Needle dashboard (same key as `needle/.env`) |
| `NEEDLE_CONNECTED_ACCOUNT_ID` | `python3 linkedin_outreach.py status` in the needle folder: the `ID` of the LinkedIn account |
| `ELEVENLABS_API_KEY` | ElevenLabs dashboard (same key as `elevenlabs/.env`) |
| `ELEVENLABS_AGENT_ID` | `npm run calls:setup-agent` creates the English agent and prints the id |
| `ELEVENLABS_PHONE_NUMBER_ID` | `python cold_call.py list-phones` in the elevenlabs folder: the imported Twilio number's `phone_number_id` |
| `ELEVENLABS_VOICE_ID` | optional, default Sarah |
| `OUTREACH_SELLER_NAME` | optional, who the outreach is for (default Meisterpfad) |

Check the setup without sending anything (lists the Needle accounts and the ElevenLabs numbers and agents, and suggests the ids):

```bash
npm run outreach:check
```

Restart `npm run dev` after changing `.env.local`.

## LinkedIn
1. Search people at the company (Needle `needleSearchLinkedinPeopleClassic`, filtered by company and job title).
2. Pick a person, draft the message with AI from their profile (`needleComposePreview`, German, formal) or write it yourself.
3. Send a connection request with a note (max 300 characters, `needleSendLinkedinInvitation`) or a message to an existing connection (`needleSendLinkedinMessage`).
The same invitation or message to the same person is blocked for 30 days.

## AI calls
`POST /v1/convai/twilio/outbound-call` with the agent, the Twilio number and the company's facts as dynamic variables. The agent speaks English, says at the start that it is an AI and that the call is recorded and transcribed, and ends the call if the person objects, is not interested or asks not to be called again. One call per company per day. "Get status and transcript" on the lead loads `GET /v1/convai/conversations/{id}`.

## Before you use it for real
This is guidance, not legal advice:
- **Calls in Germany:** phone advertising to businesses needs at least their presumed consent (§ 7 UWG); a cold sales call to a company with no prior contact usually lacks it. Recording or transcribing a call needs the other side's consent (§ 201 StGB), which is why the agent asks first. AI callers must say they are an AI (EU AI Act, Art. 50).
- **LinkedIn:** LinkedIn's terms prohibit automated messaging; accounts used through automation tools can be restricted.
- The calls go out from the Twilio number configured in ElevenLabs. Keep its credentials out of files that may be shared, such as `elevenlabs/agent_config.json`.
