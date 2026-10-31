/**
 * Faxxing connector: sends the offer fax. The provider's API is not documented in this
 * repo yet (docs/faxxing.md is missing), so this module refuses to guess endpoints or
 * parameters. Until the docs and FAXXING_API_KEY exist, every send fails with a clear
 * FaxxingNotConfiguredError that the route turns into a readable message.
 */
import { existsSync } from "node:fs";
import path from "node:path";

export const FAXXING_DOCS_PATH = path.join(process.cwd(), "docs", "faxxing.md");

export type FaxRequest = {
  /** Fax number in E.164 form, e.g. +4930123456. */
  to: string;
  /** Short subject line for the cover page. */
  subject: string;
  /** The letter as plain text, German, formal address. */
  text: string;
  /** Company id, for logs and the provider's reference field. */
  reference: string;
};

export type FaxResult = {
  provider: "faxxing";
  /** The provider's id of the fax job. */
  id: string;
  sentAt: string;
};

export class FaxxingNotConfiguredError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Faxxing not configured: ${missing.join(" and ")} missing. Add them, then implement lib/connectors/faxxing.ts from the docs.`);
    this.name = "FaxxingNotConfiguredError";
    this.missing = missing;
  }
}

export function faxxingStatus(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.FAXXING_API_KEY) missing.push("FAXXING_API_KEY");
  if (!existsSync(FAXXING_DOCS_PATH)) missing.push("docs/faxxing.md");
  return { configured: missing.length === 0, missing };
}

export async function sendFax(request: FaxRequest): Promise<FaxResult> {
  const status = faxxingStatus();
  if (!status.configured) throw new FaxxingNotConfiguredError(status.missing);
  // The docs exist and a key is set, but the HTTP call is not written yet: read docs/faxxing.md
  // and implement it here. Until then this stays an explicit error rather than a guess.
  void request;
  throw new FaxxingNotConfiguredError(["the Faxxing HTTP call in lib/connectors/faxxing.ts (see docs/faxxing.md)"]);
}
