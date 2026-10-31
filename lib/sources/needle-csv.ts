/**
 * The Needle lead list (CSV export) as a source: company name, domain, city, headcount,
 * LinkedIn company page and Lusha id. Person names stay out; the app works on companies.
 * Rows in the niche become companies; rows outside it only enrich companies other sources found.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { csvObjects, pick } from "./csv";
import { legalFormFromName, websiteOf, type StaffCount } from "./lusha";
import type { SourceRecord } from "./record";
import { inNiche } from "./regions";

export function needleRowsToRecords(
  text: string,
  options: { fetchedAt: string; allRegions?: boolean },
): { records: SourceRecord[]; outsideNiche: number; enrichOnly: SourceRecord[] } {
  const records: SourceRecord[] = [];
  const enrichOnly: SourceRecord[] = [];
  let outsideNiche = 0;
  for (const row of csvObjects(text)) {
    const name = pick(row, ["Company Name", "Company", "Firma"]);
    if (!name) continue;
    const city = pick(row, ["City", "Ort"]);
    const state = pick(row, ["State", "Bundesland"]);
    const country = pick(row, ["Country Code", "Country"]);
    const outside = !options.allRegions && ((country && !/^(de|germany|deutschland)$/i.test(country)) || !inNiche({ state, city }));
    if (outside) outsideNiche += 1;
    const headcount = Number((pick(row, ["Employee Headcount", "Employees", "Mitarbeiter"]) ?? "").replace(/[^\d]/g, ""));
    const staff: StaffCount | undefined = headcount > 0 ? { value: headcount, low: headcount, high: headcount, exact: true } : undefined;
    const trade = pick(row, ["Trade Focus", "Sub-Industry"]);
    const linkedin = pick(row, ["LinkedIn", "Linkedin URL"]);
    (outside ? enrichOnly : records).push({
      source: "needle",
      name,
      legalForm: legalFormFromName(name),
      lushaId: pick(row, ["Lusha ID"]),
      address: { ...(city ? { city } : {}) },
      website: websiteOf(pick(row, ["Company Domain", "Domain", "Website"])),
      linkedinUrl: linkedin && /linkedin\.com\/company\//.test(linkedin) ? linkedin : undefined,
      staff,
      evidence: staff
        ? [{ source: "needle", ...(linkedin ? { url: linkedin } : {}), finding: `Needle lead list: ${headcount} employees${trade ? `, ${trade}` : ""}; split into technicians and office staff at one office seat per 7 technicians`, fetchedAt: options.fetchedAt }]
        : [],
    });
  }
  return { records, outsideNiche, enrichOnly };
}

export function readNeedleCsv(file: string, options: { allRegions?: boolean } = {}): ReturnType<typeof needleRowsToRecords> | null {
  if (!existsSync(file)) return null;
  const { mtime } = statSync(file);
  return needleRowsToRecords(readFileSync(file, "utf8"), { fetchedAt: mtime.toISOString(), allRegions: options.allRegions });
}
