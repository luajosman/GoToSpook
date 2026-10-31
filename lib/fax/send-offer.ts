/**
 * The fax flow behind POST /api/fax: validate the request, require consent, apply the
 * one-per-company-per-hour limit, build the German offer letter and hand it to Faxxing.
 * Dependencies are injectable so the flow can be checked without a provider.
 */
import { z } from "zod";
import { config } from "../config";
import { FaxxingNotConfiguredError, sendFax, type FaxRequest, type FaxResult } from "../connectors/faxxing";
import type { ScoredCompany } from "../types";
import { FaxLog } from "./log";
import { normalizeFaxNumber } from "./number";
import { offerLetter, offerSubject } from "./offer";

export const faxRequestSchema = z.object({
  companyId: z.string().min(1).max(200),
  faxNumber: z
    .string()
    .min(1, "Bitte geben Sie Ihre Faxnummer ein.")
    .max(40)
    .transform((value, ctx) => {
      const normalized = normalizeFaxNumber(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Das sieht nicht nach einer Faxnummer aus. Beispiel: 030 1234567 oder +49 30 1234567." });
        return z.NEVER;
      }
      return normalized;
    }),
  consent: z.literal(true, { error: "Bitte bestätigen Sie, dass wir das Angebot an diese Faxnummer senden dürfen." }),
});

export type FaxRequestInput = z.input<typeof faxRequestSchema>;

export type SendOfferOutcome =
  | { status: "sent"; result: FaxResult }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "unknown_company" }
  | { status: "rate_limited"; retryAt: string; message: string }
  | { status: "not_configured"; message: string; missing: string[] }
  | { status: "failed"; message: string };

export type SendOfferDeps = {
  findCompany: (id: string) => ScoredCompany | undefined;
  log: FaxLog;
  send?: (request: FaxRequest) => Promise<FaxResult>;
  now?: () => Date;
  windowMs?: number;
};

export async function sendOffer(body: unknown, deps: SendOfferDeps): Promise<SendOfferOutcome> {
  const parsed = faxRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message);
    return { status: "invalid", message: issues[0] ?? "Ungültige Eingabe.", issues };
  }

  const { companyId, faxNumber } = parsed.data;
  const company = deps.findCompany(companyId);
  if (!company) return { status: "unknown_company" };

  const now = deps.now ? deps.now() : new Date();
  const windowMs = deps.windowMs ?? config.fax.perCompanyWindowMs;
  const last = deps.log.lastSentAt(companyId);
  if (last && now.getTime() - last.getTime() < windowMs) {
    const retryAt = new Date(last.getTime() + windowMs);
    const minutes = Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 60000));
    return {
      status: "rate_limited",
      retryAt: retryAt.toISOString(),
      message: `Ihr Angebot wurde vor Kurzem gefaxt. Bitte versuchen Sie es in ${minutes} ${minutes === 1 ? "Minute" : "Minuten"} erneut.`,
    };
  }

  const request: FaxRequest = {
    to: faxNumber,
    subject: offerSubject(company),
    text: offerLetter(company, now),
    reference: company.id,
  };

  try {
    const result = await (deps.send ?? sendFax)(request);
    deps.log.record({ companyId, sentAt: result.sentAt, providerId: result.id });
    return { status: "sent", result };
  } catch (error) {
    if (error instanceof FaxxingNotConfiguredError) {
      return {
        status: "not_configured",
        missing: error.missing,
        message: "Der Faxversand ist noch nicht eingerichtet. Ihr Angebot wurde nicht gesendet.",
      };
    }
    return {
      status: "failed",
      message: `Der Faxversand ist fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
