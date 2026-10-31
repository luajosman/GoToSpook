# Outreach: LinkedIn (Needle) and AI calls (ElevenLabs)

The LinkedIn and phone buttons on a lead page start one action for that one company, after a person confirms it in a dialog. Every action is saved on the lead (Outreach section): LinkedIn messages with their text, calls with status, duration, summary and transcript. The log lives in `data/outreach/<company-id>.json`, which is git-ignored because it holds personal data.

Both connectors are TypeScript ports of the team's Python scripts (`needle/linkedin_outreach.py`, `elevenlabs/cold_call.py`) and call exactly the endpoints those scripts use.

## Setup (`.env.local`)

| Variable | Where it comes from |
|---|---|
| `NEEDLE_API_KEY` | Needle dashboard (same key as `needle/.env`) |
| `NEEDLE_CONNECTED_ACCOUNT_ID` | `python3 linkedin_outreach.py status` in the needle folder: the `ID` of the LinkedIn account |
| `NEEDLE_CAMPAIGN_ID` | the Needle campaign leads are enrolled in (`npm run outreach:check` lists them) |
| `ELEVENLABS_API_KEY` | ElevenLabs dashboard (same key as `elevenlabs/.env`) |
| `ELEVENLABS_AGENT_ID` | `npm run calls:setup-agent` creates the English agent and prints the id |
| `ELEVENLABS_PHONE_NUMBER_ID` | the caller number's id in ElevenLabs: `npm run calls:import-number` (below) or `python cold_call.py list-phones` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | only for `calls:import-number`; use a fresh token |
| `ELEVENLABS_VOICE_ID` | optional, default Sarah |
| `OUTREACH_SELLER_NAME` | optional, who the outreach is for (default Meisterpfad) |
| `OUTREACH_DEFAULT_CALL_TO` | optional, the number the call dialog fills in when a company has none, e.g. your own phone for a demo |

Check the setup without sending anything (lists the Needle accounts and the ElevenLabs numbers and agents, and suggests the ids):

```bash
npm run outreach:check
```

Restart `npm run dev` after changing `.env.local`.

## LinkedIn (Needle campaign)
1. Search people at the company (Needle `needleSearchLinkedinPeopleClassic`, filtered by company and job title).
2. Pick a person and add them to the campaign: `needleUpsertLead` (LinkedIn profile, name, company, domain, Europe/Berlin) and `needleEnrollCampaignLeads`.
3. Needle runs the campaign: it checks the connection, sends the invitation, writes the first message with AI and follows up. It sends nothing while the campaign is a draft or paused; activate it in Needle.
4. "Refresh from Needle" on the lead loads the enrollment status and the lead's events (`needleGetLead`, `needleListLeadEvents`), including the text of every message Needle sent.
The same person is not enrolled twice in the same campaign; Needle's own skips (do-not-contact, recently contacted) are shown as the reason.

## AI calls
`POST /v1/convai/twilio/outbound-call` with the agent, the Twilio number and the company's facts as dynamic variables. The agent speaks English, says at the start that it is an AI and that the call is recorded and transcribed, and ends the call if the person objects, is not interested or asks not to be called again. One call per company per day. "Get status and transcript" on the lead loads `GET /v1/convai/conversations/{id}`.

## Calling from your own number
ElevenLabs calls from a number it can control through Twilio. A number not bought from Twilio, such as a German mobile number, works as a **Verified Caller ID**, for outbound calls only:
1. Twilio Console > Phone Numbers > Manage > Verified Caller IDs > Add: enter the number; Twilio calls it (in English) with a code you type in.
2. Put `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` into `.env.local`, then import the number and make it the caller:

```bash
npm run calls:import-number -- 01571234567 --write
```

3. `npm run outreach:check`, then restart `npm run dev`.

## Before you use it for real
This is guidance, not legal advice:
- **Calls in Germany:** phone advertising to businesses needs at least their presumed consent (§ 7 UWG); a cold sales call to a company with no prior contact usually lacks it. Recording or transcribing a call needs the other side's consent (§ 201 StGB), which is why the agent asks first. AI callers must say they are an AI (EU AI Act, Art. 50).
- **LinkedIn:** LinkedIn's terms prohibit automated messaging; accounts used through automation tools can be restricted.
- The calls go out from the Twilio number configured in ElevenLabs. Keep its credentials out of files that may be shared, such as `elevenlabs/agent_config.json`.
