/**
 * Lusha connector, written from docs/lusha.md. Only the calls documented there:
 * company prospecting search, filter values and account usage. Server-side only.
 */
import { z } from "zod";

export const LUSHA_BASE_URL = "https://api.lusha.com/v3";

export class LushaNotConfiguredError extends Error {
  constructor() {
    super("Lusha not configured: LUSHA_API_KEY missing in .env.local.");
    this.name = "LushaNotConfiguredError";
  }
}

export class LushaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "LushaApiError";
  }
}

const ERROR_TEXT: Record<number, string> = {
  400: "Lusha rejected the request (malformed or missing fields)",
  401: "Lusha API key is missing or invalid",
  402: "Not enough Lusha credits",
  403: "Lusha account is inactive",
  429: "Lusha rate limit or daily quota reached",
};

const looseNumber = z.number().nullish();

export const usageSchema = z.object({
  credits: z.object({ total: looseNumber, used: looseNumber, remaining: looseNumber }).partial().nullish(),
  pricing: z.record(z.string(), z.object({ credits: z.number(), perQuantity: z.number().nullish() }).partial()).nullish(),
});
export type LushaUsage = z.infer<typeof usageSchema>;

const industrySchema = z.union([z.string(), z.object({ name: z.string().nullish(), label: z.string().nullish() }).loose()]).nullish();

export const lushaCompanySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().nullish(),
  domain: z.string().nullish(),
  employeeCount: z.object({ exact: looseNumber, min: looseNumber, max: looseNumber }).partial().nullish(),
  industry: industrySchema,
  location: z
    .object({ city: z.string().nullish(), state: z.string().nullish(), country: z.string().nullish(), countryIso2: z.string().nullish() })
    .partial()
    .nullish(),
  socialLinks: z.object({ linkedin: z.string().nullish() }).partial().nullish(),
});
export type LushaCompany = z.infer<typeof lushaCompanySchema>;

export const prospectResponseSchema = z.object({
  pagination: z.object({ page: looseNumber, size: looseNumber, total: looseNumber }).partial().nullish(),
  results: z.array(lushaCompanySchema).default([]),
  billing: z.object({ creditsCharged: looseNumber, resultsReturned: looseNumber }).partial().nullish(),
});
export type ProspectResponse = z.infer<typeof prospectResponseSchema>;

export type CompanyIncludeFilters = Record<string, unknown>;

export type ProspectRequest = {
  page: number;
  size: number;
  include: CompanyIncludeFilters;
};

export interface LushaClient {
  usage(): Promise<LushaUsage>;
  prospect(request: ProspectRequest): Promise<ProspectResponse>;
  filterValues(filterType: string, query?: string): Promise<{ values: unknown; total?: number | null; truncated?: boolean | null }>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createLushaClient(options: { apiKey?: string; fetchImpl?: FetchLike; baseUrl?: string; maxRetries?: number } = {}): LushaClient {
  const apiKey = options.apiKey ?? process.env.LUSHA_API_KEY;
  if (!apiKey) throw new LushaNotConfiguredError();
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? LUSHA_BASE_URL;
  const maxRetries = options.maxRetries ?? 3;

  async function call(path: string, init: RequestInit = {}): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: { api_key: apiKey!, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
      });
      if (response.ok) return response.json();
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
        continue;
      }
      let detail = "";
      try {
        const body = (await response.json()) as { message?: unknown };
        if (typeof body.message === "string") detail = `: ${body.message}`;
      } catch {
        // no JSON body
      }
      const base = ERROR_TEXT[response.status] ?? `Lusha answered ${response.status}`;
      throw new LushaApiError(response.status, `${base}${detail}`);
    }
  }

  return {
    async usage() {
      return usageSchema.parse(await call("/account/usage"));
    },
    async prospect({ page, size, include }) {
      const body = { pagination: { page, size }, filters: { companies: { include } } };
      return prospectResponseSchema.parse(await call("/companies/prospecting", { method: "POST", body: JSON.stringify(body) }));
    },
    async filterValues(filterType, query) {
      const qs = query ? `?query=${encodeURIComponent(query)}` : "";
      const parsed = z
        .object({ values: z.unknown(), total: looseNumber, truncated: z.boolean().nullish() })
        .parse(await call(`/companies/prospecting/filters/${encodeURIComponent(filterType)}${qs}`));
      return parsed;
    },
  };
}

/** Credits per search result, from the live price list; 1 when the plan does not list it. */
export function creditsPerResult(usage: LushaUsage): number {
  const price = usage.pricing?.api_search;
  if (!price?.credits) return 1;
  return price.credits / (price.perQuantity || 1);
}
