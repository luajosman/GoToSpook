/**
 * Fax log for the rate limit: one fax per company per hour. Kept in data/fax/sent.json
 * (git-ignored) so it survives a dev-server restart. Only ids and timestamps, no numbers.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export type FaxLogEntry = { companyId: string; sentAt: string; providerId: string };

const entrySchema = z.object({ companyId: z.string(), sentAt: z.string(), providerId: z.string() });
const logSchema = z.array(entrySchema);

export const FAX_LOG_PATH = path.join(process.cwd(), "data", "fax", "sent.json");

export interface FaxLog {
  lastSentAt(companyId: string): Date | null;
  record(entry: FaxLogEntry): void;
}

/** In-memory log, for tests and as a fallback when the data folder is not writable. */
export class MemoryFaxLog implements FaxLog {
  private entries: FaxLogEntry[] = [];

  lastSentAt(companyId: string): Date | null {
    return lastOf(this.entries, companyId);
  }

  record(entry: FaxLogEntry): void {
    this.entries.push(entry);
  }
}

export class FileFaxLog implements FaxLog {
  constructor(private readonly file: string = FAX_LOG_PATH) {}

  private read(): FaxLogEntry[] {
    if (!existsSync(this.file)) return [];
    try {
      return logSchema.parse(JSON.parse(readFileSync(this.file, "utf8")));
    } catch {
      return [];
    }
  }

  lastSentAt(companyId: string): Date | null {
    return lastOf(this.read(), companyId);
  }

  record(entry: FaxLogEntry): void {
    const entries = [...this.read(), entry];
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(entries, null, 2) + "\n");
  }
}

function lastOf(entries: FaxLogEntry[], companyId: string): Date | null {
  let last: Date | null = null;
  for (const entry of entries) {
    if (entry.companyId !== companyId) continue;
    const at = new Date(entry.sentAt);
    if (!Number.isNaN(at.getTime()) && (!last || at > last)) last = at;
  }
  return last;
}
