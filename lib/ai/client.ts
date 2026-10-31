/**
 * OpenAI access for the app, server-side only. One shape for every AI feature: a zod
 * schema in, a validated object out (Responses API + structured outputs), cached on disk.
 * The model writes and extracts; prices, thresholds and motions stay in TypeScript.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { readCache, writeCache, type CacheEntry } from "../cache";

export class AiNotConfiguredError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`OpenAI not configured: ${missing.join(" and ")} missing in .env.local.`);
    this.name = "AiNotConfiguredError";
    this.missing = missing;
  }
}

export function aiStatus(): { configured: boolean; missing: string[]; model: string | null } {
  const missing: string[] = [];
  if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (!process.env.OPENAI_MODEL) missing.push("OPENAI_MODEL");
  return { configured: missing.length === 0, missing, model: process.env.OPENAI_MODEL || null };
}

export type StructuredRequest<T> = {
  schema: z.ZodType<T>;
  /** Model-visible name of the output format. */
  name: string;
  instructions: string;
  input: string;
};

/** Runs one structured request. Swappable so features can be checked without the API. */
export type Runner = <T>(request: StructuredRequest<T>) => Promise<T>;

let client: OpenAI | null = null;

export const openAiRunner: Runner = async (request) => {
  const status = aiStatus();
  if (!status.configured) throw new AiNotConfiguredError(status.missing);
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: status.model!,
    instructions: request.instructions,
    input: request.input,
    text: { format: zodTextFormat(request.schema, request.name) },
    store: false,
  });
  if (response.output_parsed == null) throw new Error("The model returned no structured answer.");
  return request.schema.parse(response.output_parsed);
};

export type Generated<T> = { value: T; generatedAt: string; cached: boolean };

/** Reads data/cache/openai/<kind>-<key>.json, or asks the model and stores the answer. */
export async function cachedStructured<T>(
  kind: string,
  key: string,
  request: StructuredRequest<T>,
  options: { runner?: Runner; refresh?: boolean; cacheRoot?: string } = {},
): Promise<Generated<T>> {
  const cacheKey = `${kind}-${key}`;
  if (!options.refresh) {
    const hit = readCache("openai", cacheKey, request.schema, options.cacheRoot);
    if (hit) return { value: hit.value, generatedAt: hit.storedAt, cached: true };
  }
  const value = await (options.runner ?? openAiRunner)(request);
  const entry: CacheEntry<T> = writeCache("openai", cacheKey, value, { kind, model: process.env.OPENAI_MODEL ?? "" }, options.cacheRoot);
  return { value, generatedAt: entry.storedAt, cached: false };
}

/** Cached answer only, for rendering a page without calling the model. */
export function cachedOnly<T>(kind: string, key: string, schema: z.ZodType<T>, cacheRoot?: string): Generated<T> | null {
  const hit = readCache("openai", `${kind}-${key}`, schema, cacheRoot);
  return hit ? { value: hit.value, generatedAt: hit.storedAt, cached: true } : null;
}

/** Turns an error from a feature into the JSON a route returns. */
export function aiErrorResponse(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof AiNotConfiguredError) {
    return { status: 503, body: { status: "not_configured", message: error.message, missing: error.missing } };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { status: 502, body: { status: "failed", message: `The AI request failed: ${message}` } };
}
