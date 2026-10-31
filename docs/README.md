# Provider docs

Put the API documentation of every external tool here before writing its connector, one file per provider. A connector is written from its doc, never from guessed endpoints or parameters. If a doc is missing, the connector stays a stub that fails with a clear message.

| File | Provider | Used for | Env var |
|---|---|---|---|
| `needle.md` | Needle | Fetch and read company websites | `NEEDLE_API_KEY` |
| `openai.md` | OpenAI | Extract drivers, write briefings and letters | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `register-api.md` | Register API | Register details, new registrations | `REGISTER_API_KEY` |
| `aiark.md` | AI Ark | Buying groups and lookalikes, high-touch only | `AI_ARK_API_KEY` |
| `blitz.md` | Blitz API | Verify contact details, high-touch only | `BLITZ_API_KEY` |
| `lusha.md` | Lusha | Direct numbers, top accounts only (150 credits) | `LUSHA_API_KEY` |
| `faxxing.md` | Faxxing | Send the offer fax, on request only (100 faxes) | `FAXXING_API_KEY` |

Keys go into `.env.local` (git-ignored), see `.env.example`. Every call is cached in `data/cache/<provider>/<key>.json`.
