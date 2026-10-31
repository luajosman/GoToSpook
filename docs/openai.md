# OpenAI: what the app calls

Built with the official `openai` npm package (v7), server-side only (`lib/ai/client.ts`).

| Env var | Meaning |
|---|---|
| `OPENAI_API_KEY` | API key, in `.env.local` only |
| `OPENAI_MODEL` | Model id used for every call, e.g. OpenAI's current small model with structured outputs |

## The one call we make

```ts
const response = await client.responses.parse({
  model: process.env.OPENAI_MODEL,
  instructions,                // the feature's system-style instructions
  input,                       // the company data or question, as text
  text: { format: zodTextFormat(schema, name) },   // strict JSON schema from zod
  store: false,
});
response.output_parsed;        // validated again with the same zod schema
```

Every answer is cached in `data/cache/openai/<kind>-<hash>.json`. The hash covers the inputs and a prompt version, so changed evidence or prompts produce a new answer and reruns cost nothing.

## Features

| Kind | Where | Output |
|---|---|---|
| `briefing` | Lead page, "Briefing" | Why contact now, talking points, a German opening line, what to watch out for |
| `welcome` | Lead page of a welcome company | Congratulations letter and an intro request to a partner, both German, formal "Sie" |
| `ask` | Overview, "Ask the data" | An answer plus the companies it is based on, checked against the loaded run |

The model only writes and extracts. Prices, ACV, threshold and motion come from `lib/score` and are passed in as facts. Without a key the routes answer 503 with "OpenAI not configured".
