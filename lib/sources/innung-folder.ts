/**
 * Guild member exports: every CSV in data/raw/innung/ is a source. Column names may be German
 * or English (Firma/Company, Straße/Street, PLZ/Zip, Ort/City, Telefon/Phone, Website, Mitarbeiter).
 * The file name becomes the guild name.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { csvObjects, pick } from "./csv";
import { legalFormFromName, websiteOf, type StaffCount } from "./lusha";
import type { SourceRecord } from "./record";

export function guildRowsToRecords(text: string, guild: string, fetchedAt: string): SourceRecord[] {
  const records: SourceRecord[] = [];
  for (const row of csvObjects(text)) {
    const name = pick(row, ["Firma", "Firmenname", "Betrieb", "Company", "Company Name", "Name"]);
    if (!name) continue;
    const staffNum = Number((pick(row, ["Mitarbeiter", "Beschäftigte", "Employees", "Employee Headcount"]) ?? "").replace(/[^\d]/g, ""));
    const staff: StaffCount | undefined = staffNum > 0 ? { value: staffNum, low: staffNum, high: staffNum, exact: true } : undefined;
    const street = pick(row, ["Straße", "Strasse", "Str.", "Street", "Adresse", "Address"]);
    const zip = pick(row, ["PLZ", "Postleitzahl", "Zip", "Postal Code"]);
    const city = pick(row, ["Ort", "Stadt", "City"]);
    records.push({
      source: "innung",
      name,
      legalForm: legalFormFromName(name),
      address: { ...(street ? { street } : {}), ...(zip ? { zip } : {}), ...(city ? { city } : {}) },
      website: websiteOf(pick(row, ["Website", "Homepage", "Internet", "Web", "URL"])),
      phone: pick(row, ["Telefon", "Tel", "Tel.", "Phone"]),
      guild,
      staff,
      evidence: [
        {
          source: "innung",
          finding: `Member of ${guild}${staff ? `, ${staffNum} employees listed` : ""}`,
          fetchedAt,
        },
      ],
    });
  }
  return records;
}

export function readGuildFolder(folder: string): { records: SourceRecord[]; files: number } {
  if (!existsSync(folder)) return { records: [], files: 0 };
  const files = readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".csv"));
  const records = files.flatMap((f) => {
    const file = path.join(folder, f);
    const guild = path.basename(f, path.extname(f)).replace(/[_-]+/g, " ").trim();
    return guildRowsToRecords(readFileSync(file, "utf8"), guild, statSync(file).mtime.toISOString());
  });
  return { records, files: files.length };
}
