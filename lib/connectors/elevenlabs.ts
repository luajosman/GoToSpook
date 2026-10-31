/**
 * ElevenLabs Conversational AI outbound calls, ported from the team's elevenlabs/cold_call.py:
 * POST /v1/convai/twilio/outbound-call to start, GET /v1/convai/conversations/{id} for the
 * transcript. Server-side only; the agent and the Twilio number are set up once (see docs).
 */
import { z } from "zod";

export const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export class ElevenLabsNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(`Calls not configured: ${missing.join(", ")} missing in .env.local.`);
    this.name = "ElevenLabsNotConfiguredError";
  }
}

export class ElevenLabsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

export function callStatus(): { configured: boolean; missing: string[] } {
  const missing = ["ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_PHONE_NUMBER_ID"].filter((k) => !process.env[k]);
  return { configured: missing.length === 0, missing };
}

export const conversationSchema = z
  .object({
    conversation_id: z.string().nullish(),
    status: z.string().nullish(),
    call_duration_secs: z.number().nullish(),
    metadata: z.object({ call_duration_secs: z.number().nullish(), start_time_unix_secs: z.number().nullish() }).loose().nullish(),
    transcript: z
      .array(z.object({ role: z.string().nullish(), message: z.string().nullish(), time_in_call_secs: z.number().nullish() }).loose())
      .nullish(),
    analysis: z.object({ transcript_summary: z.string().nullish(), call_successful: z.string().nullish() }).loose().nullish(),
  })
  .loose();

export type Conversation = {
  status: string;
  durationSecs: number | null;
  transcript: Array<{ role: string; message: string; atSecs?: number }>;
  summary: string | null;
};

export function toConversation(raw: unknown): Conversation {
  const c = conversationSchema.parse(raw);
  return {
    status: c.status ?? "unknown",
    durationSecs: c.call_duration_secs ?? c.metadata?.call_duration_secs ?? null,
    transcript: (c.transcript ?? [])
      .filter((t) => t.message)
      .map((t) => ({ role: t.role ?? "unknown", message: t.message!, ...(t.time_in_call_secs != null ? { atSecs: t.time_in_call_secs } : {}) })),
    summary: c.analysis?.transcript_summary ?? null,
  };
}

export interface CallClient {
  startCall(input: { to: string; variables: Record<string, string> }): Promise<{ conversationId: string | null; callSid: string | null }>;
  getConversation(conversationId: string): Promise<Conversation>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createCallClient(options: { fetchImpl?: FetchLike } = {}): CallClient {
  const status = callStatus();
  if (!status.configured) throw new ElevenLabsNotConfiguredError(status.missing);
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" };

  async function call(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetchImpl(`${ELEVENLABS_BASE_URL}${path}`, { ...init, headers, signal: AbortSignal.timeout(30_000) });
    const text = await response.text();
    if (!response.ok) throw new ElevenLabsError(response.status, `ElevenLabs answered ${response.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  }

  return {
    async startCall({ to, variables }) {
      const result = (await call("/convai/twilio/outbound-call", {
        method: "POST",
        body: JSON.stringify({
          agent_id: process.env.ELEVENLABS_AGENT_ID,
          agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID,
          to_number: to,
          conversation_initiation_client_data: { type: "conversation_initiation_client_data", dynamic_variables: variables },
        }),
      })) as { conversation_id?: string; callSid?: string; success?: boolean; message?: string };
      if (result.success === false) throw new ElevenLabsError(400, result.message ?? "The call could not be started");
      return { conversationId: result.conversation_id ?? null, callSid: result.callSid ?? null };
    },
    async getConversation(conversationId) {
      return toConversation(await call(`/convai/conversations/${encodeURIComponent(conversationId)}`));
    },
  };
}
