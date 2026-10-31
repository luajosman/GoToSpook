/**
 * One shape for every source (Lusha, Needle CSV, guild exports, the Brandenburg directory),
 * merged by Lusha id or by name and city, then turned into a scoring input.
 */
import type { ScoreInput } from "../score";
import { normalizeName } from "../slug";
import { companyId, slugify } from "../slug";
import type { Company, CompanySource, Confidence, Driver, Evidence, LegalForm } from "../types";
import { techniciansFromStaff, type StaffCount } from "./lusha";

export type SourceRecord = {
  source: CompanySource;
  name: string;
  legalForm?: LegalForm;
  lushaId?: string;
  address: { street?: string; zip?: string; city?: string };
  website?: string;
  phone?: string;
  linkedinUrl?: string;
  guild?: string;
  registeredAt?: string;
  staff?: StaffCount;
  evidence: Evidence[];
};

export type MergedCompany = Omit<SourceRecord, "source"> & { sources: CompanySource[] };

function mergeKey(r: { lushaId?: string; name: string; address: { zip?: string; city?: string } }): string {
  return `${normalizeName(r.name)}|${slugify(r.address.city ?? "") || r.address.zip || ""}`;
}

/** Merges records of the same company; the first non-empty value wins, exact staff counts beat ranges. */
export function mergeRecords(records: readonly SourceRecord[]): MergedCompany[] {
  const byKey = new Map<string, MergedCompany>();
  const byLusha = new Map<string, MergedCompany>();
  for (const r of records) {
    const key = mergeKey(r);
    const existing = (r.lushaId ? byLusha.get(r.lushaId) : undefined) ?? byKey.get(key);
    if (!existing) {
      const { source, ...rest } = r;
      const merged: MergedCompany = { ...rest, address: { ...r.address }, evidence: [...r.evidence], sources: [source] };
      byKey.set(key, merged);
      if (r.lushaId) byLusha.set(r.lushaId, merged);
      continue;
    }
    if (!existing.sources.includes(r.source)) existing.sources.push(r.source);
    existing.address = { street: existing.address.street ?? r.address.street, zip: existing.address.zip ?? r.address.zip, city: existing.address.city ?? r.address.city };
    existing.legalForm = existing.legalForm && existing.legalForm !== "unknown" ? existing.legalForm : r.legalForm;
    existing.lushaId ??= r.lushaId;
    existing.website ??= r.website;
    existing.phone ??= r.phone;
    existing.linkedinUrl ??= r.linkedinUrl;
    existing.guild ??= r.guild;
    existing.registeredAt ??= r.registeredAt;
    if (r.staff && (!existing.staff || (r.staff.exact && !existing.staff.exact))) existing.staff = r.staff;
    existing.evidence.push(...r.evidence);
    if (existing.lushaId) byLusha.set(existing.lushaId, existing);
    byKey.set(key, existing);
  }
  return [...new Set(byKey.values())];
}

/**
 * The brief's fallback when no source gives a team size: legal form and a missing website
 * mean a small company, with low confidence. Ranges, not numbers to trust.
 */
export function fallbackStaff(legalForm: LegalForm | undefined, hasWebsite: boolean): StaffCount {
  if (legalForm === "sole_trader" || legalForm === "e.K.") return { value: 2, low: 1, high: hasWebsite ? 4 : 3, exact: false };
  if (legalForm === "GmbH" || legalForm === "GmbH & Co. KG") return { value: hasWebsite ? 6 : 4, low: 2, high: hasWebsite ? 12 : 8, exact: false };
  if (legalForm === "UG") return { value: 3, low: 1, high: 6, exact: false };
  return { value: hasWebsite ? 4 : 2, low: 1, high: hasWebsite ? 8 : 5, exact: false };
}

export function toScoreInput(m: MergedCompany): ScoreInput {
  const measured = m.staff;
  const staff = measured ?? fallbackStaff(m.legalForm, Boolean(m.website));
  const confidence: Confidence = measured ? (measured.exact ? "medium" : "low") : "low";
  const evidence: Evidence[] = measured
    ? m.evidence
    : [
        ...m.evidence,
        {
          source: m.sources.includes("innung") ? "innung" : m.sources[0] === "needle" ? "needle" : "lusha",
          finding: `No team size in any source; estimated as a small company from its legal form (${m.legalForm ?? "unknown"})${m.website ? "" : " and the missing website"}`,
          fetchedAt: m.evidence[0]?.fetchedAt ?? new Date(0).toISOString(),
        },
      ];
  const techs = (n: number) => techniciansFromStaff(n);
  const seats = (n: number) => Math.max(1, Math.floor(n) - techniciansFromStaff(n));
  const technicians: Driver = { value: techs(staff.value), low: techs(staff.low), high: techs(staff.high), confidence, evidence };
  const officeSeats: Driver = { value: seats(staff.value), low: seats(staff.low), high: seats(staff.high), confidence, evidence: [] };

  const company: Company = {
    id: companyId(m.name, m.address.zip ?? (m.address.city ? slugify(m.address.city) : undefined)),
    name: m.name,
    legalForm: m.legalForm ?? "unknown",
    address: Object.fromEntries(Object.entries(m.address).filter(([, v]) => v)) as Company["address"],
    sources: m.sources,
    ...(m.website ? { website: m.website } : {}),
    ...(m.phone ? { phone: m.phone } : {}),
    ...(m.linkedinUrl ? { linkedinUrl: m.linkedinUrl } : {}),
    ...(m.guild ? { guild: m.guild } : {}),
    ...(m.registeredAt ? { registeredAt: m.registeredAt } : {}),
  };
  return { company, technicians, officeSeats };
}

/**
 * Folds enrichment-only records into companies that already exist: by normalized name when exactly one
 * company has it, or by website domain. Never adds companies. Returns how many were enriched.
 */
export function enrichMerged(merged: MergedCompany[], extra: readonly SourceRecord[]): number {
  const byName = new Map<string, MergedCompany[]>();
  const byDomain = new Map<string, MergedCompany>();
  const domainOf = (url?: string) => url?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "").toLowerCase();
  for (const m of merged) {
    const key = normalizeName(m.name);
    byName.set(key, [...(byName.get(key) ?? []), m]);
    const d = domainOf(m.website);
    if (d) byDomain.set(d, m);
  }
  let enriched = 0;
  for (const r of extra) {
    const named = byName.get(normalizeName(r.name));
    const target = (named?.length === 1 ? named[0] : undefined) ?? (domainOf(r.website) ? byDomain.get(domainOf(r.website)!) : undefined);
    if (!target) continue;
    if (!target.sources.includes(r.source)) target.sources.push(r.source);
    target.website ??= r.website;
    target.linkedinUrl ??= r.linkedinUrl;
    target.lushaId ??= r.lushaId;
    if (r.staff && (!target.staff || (r.staff.exact && !target.staff.exact))) target.staff = r.staff;
    target.evidence.push(...r.evidence);
    enriched += 1;
  }
  return enriched;
}
