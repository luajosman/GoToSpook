/**
 * Fachverband SHK Land Brandenburg, public company search (https://www.brandenburg-shk.de/de/firmensuche/).
 * robots.txt allows the path. We read only the result list per guild (name, street, postcode, city),
 * never the detail pages with contact data: one request per guild, a pause between requests,
 * an identifying user agent, and results cached for days.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cachePath } from "../cache";
import { legalFormFromName } from "./lusha";
import type { SourceRecord } from "./record";

export const BB_SHK_URL = "https://www.brandenburg-shk.de/de/firmensuche/";
export const USER_AGENT = "ACV-Router/0.1 (GoToSpook, github.com/luajosman/GoToSpook)";

/** Guild ids from the search form. The stove builders' guild (100) is not HVAC and is left out. */
export const GUILDS: Record<string, string> = {
  "87": "Innung des SHK-Handwerks Brandenburg an der Havel / Belzig",
  "88": "Innung Sanitär-, Heizungs-, Klima- und Klempnertechnik Cottbus",
  "89": "Installateur- und Heizungsbauer-Innung Finsterwalde",
  "90": "Innung der Sanitär-, Heizungs- und Klimatechnik Frankfurt (Oder)",
  "91": "Innung Sanitär-Heizung-Klempner-Klima Königs Wusterhausen",
  "92": "Innung SHK Ober- & Niederbarnim",
  "93": "Innung für Sanitär- Heizungs- und Klimatechnik des Kreises Oberhavel",
  "94": "Innung SHK-Technik Oder-Spree",
  "95": "Sanitär-Heizung-Klima Innung Ostprignitz – Ruppin",
  "96": "Innung Sanitär-, Heizungs-, Klempner- und Klimatechnik Potsdam",
  "97": "SHK-Innung Prignitz",
  "98": "Innung SHKK Süd-Ost im Land Brandenburg",
  "99": "Innung SHK Uckermark",
  "101": "Einzelmitglieder Fachverband SHK Brandenburg",
  "134": "Innung SHK Berlin",
};

export type DirectoryEntry = { id: string; name: string; street?: string; zip?: string; city?: string };

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses the result list: one <li class="list-group-item ..."> per company with data-company-* attributes. */
export function parseResults(html: string): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  const items = html.split(/<li\s+class="list-group-item[^"]*"/).slice(1);
  for (const item of items) {
    const attr = (name: string) => {
      const m = item.match(new RegExp(`data-company-${name}="([^"]*)"`));
      return m ? decode(m[1]) : undefined;
    };
    const link = item.match(/href="\/de\/firmensuche\/firma\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    const name = attr("title") ?? (link ? decode(link[2].replace(/<[^>]+>/g, "")) : undefined);
    if (!name || !link) continue;
    const address = item.match(/<p class="small mb-0">([\s\S]*?)<\/p>/);
    const street = address ? decode(address[1].split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, "")) : undefined;
    entries.push({ id: link[1], name, street: street || undefined, zip: attr("postal-code") || undefined, city: attr("city") || undefined });
  }
  return entries;
}

export function entriesToRecords(entries: DirectoryEntry[], guild: string, fetchedAt: string): SourceRecord[] {
  return entries.map((e) => ({
    source: "innung",
    name: e.name,
    legalForm: legalFormFromName(e.name),
    address: { ...(e.street ? { street: e.street } : {}), ...(e.zip ? { zip: e.zip } : {}), ...(e.city ? { city: e.city } : {}) },
    guild,
    evidence: [{ source: "innung", url: `https://www.brandenburg-shk.de/de/firmensuche/firma/${e.id}/`, finding: `Member of ${guild}, listed in the Fachverband SHK Brandenburg company search`, fetchedAt }],
  }));
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** One search per guild: GET for the CSRF token and cookie, then POST the form. */
async function searchGuild(guildId: string, fetchImpl: FetchLike): Promise<string> {
  const page = await fetchImpl(BB_SHK_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!page.ok) throw new Error(`brandenburg-shk.de answered ${page.status}`);
  const html = await page.text();
  const token = [...html.matchAll(/name="csrfmiddlewaretoken" value="([^"]+)"/g)].pop()?.[1];
  const cookie = (page.headers.get("set-cookie") ?? "").match(/csrftoken=[^;]+/)?.[0];
  if (!token || !cookie) throw new Error("brandenburg-shk.de: search form changed (no CSRF token)");
  const body = new URLSearchParams({ csrfmiddlewaretoken: token, innung: guildId, company: "", q: "", postal_code: "", city: "" });
  const result = await fetchImpl(BB_SHK_URL, {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie, Referer: BB_SHK_URL },
    body,
  });
  if (!result.ok) throw new Error(`brandenburg-shk.de answered ${result.status} for guild ${guildId}`);
  return result.text();
}

export type ScrapeOptions = {
  cacheRoot: string;
  now: Date;
  cacheDays: number;
  pauseMs?: number;
  guilds?: string[];
  fetchImpl?: FetchLike;
  log?: (line: string) => void;
  /** Only read cached pages (of any age); never request anything. */
  offline?: boolean;
};

/** Returns records for every guild; fresh cached pages are reused, stale ones fetched again. */
export async function scrapeBrandenburgShk(options: ScrapeOptions): Promise<{ records: SourceRecord[]; fetched: number; fromCache: number; errors: string[] }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const pause = options.pauseMs ?? 3000;
  const records: SourceRecord[] = [];
  const errors: string[] = [];
  let fetched = 0;
  let fromCache = 0;
  for (const guildId of options.guilds ?? Object.keys(GUILDS)) {
    const guild = GUILDS[guildId] ?? `Guild ${guildId}`;
    const file = cachePath("brandenburg-shk", `guild-${guildId}`, options.cacheRoot);
    let cached: { storedAt: string; entries: DirectoryEntry[] } | null = null;
    if (existsSync(file)) {
      try {
        cached = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        cached = null;
      }
    }
    const fresh = cached && options.now.getTime() - new Date(cached.storedAt).getTime() < options.cacheDays * 86_400_000;
    if (cached && (fresh || options.offline)) {
      fromCache += 1;
      records.push(...entriesToRecords(cached.entries, guild, cached.storedAt));
      continue;
    }
    if (options.offline) continue;
    try {
      if (fetched > 0 && pause > 0) await new Promise((r) => setTimeout(r, pause));
      const entries = parseResults(await searchGuild(guildId, fetchImpl));
      fetched += 1;
      const storedAt = options.now.toISOString();
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({ storedAt, entries }, null, 2) + "\n");
      records.push(...entriesToRecords(entries, guild, storedAt));
      options.log?.(`${guild}: ${entries.length} companies`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      if (cached) records.push(...entriesToRecords(cached.entries, guild, cached.storedAt));
    }
  }
  return { records, fetched, fromCache, errors };
}
