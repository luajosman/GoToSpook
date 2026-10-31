/**
 * Turns a Lusha company search result into a scoring input. Lusha gives total staff;
 * the brief's ratio (one office seat per 7 technicians) splits it into the two drivers.
 * Nothing is guessed: no staff count means no estimate, and ranges lower the confidence.
 */
import type { LushaCompany } from "../connectors/lusha";
import type { ScoreInput } from "../score";
import { officeSeatsFallback } from "../score/formula";
import { companyId, slugify } from "../slug";
import type { Company, Confidence, Driver, Evidence, LegalForm } from "../types";

export function legalFormFromName(name: string): LegalForm {
  const n = name.replace(/\s+/g, " ");
  if (/GmbH\s*&\s*Co\.?\s*KG/i.test(n)) return "GmbH & Co. KG";
  if (/\bGmbH\b/i.test(n)) return "GmbH";
  if (/\bUG\b/.test(n)) return "UG";
  if (/\be\.\s?K\.?(\s|$)/i.test(n) || /\beK\b/.test(n)) return "e.K.";
  return "unknown";
}

/** Technicians in a staff of `staff`: the largest t with t + officeSeats(t) ≤ staff. */
export function techniciansFromStaff(staff: number): number {
  const total = Math.max(0, Math.floor(staff));
  let t = 0;
  while (t + 1 + officeSeatsFallback(t + 1) <= total) t += 1;
  return t + officeSeatsFallback(t) <= total ? t : 0;
}

export type StaffCount = { value: number; low: number; high: number; exact: boolean };

export function staffCount(company: LushaCompany): StaffCount | null {
  const ec = company.employeeCount;
  if (!ec) return null;
  if (typeof ec.exact === "number" && ec.exact > 0) return { value: ec.exact, low: ec.exact, high: ec.exact, exact: true };
  const min = typeof ec.min === "number" ? ec.min : null;
  const max = typeof ec.max === "number" ? ec.max : null;
  if (min === null && max === null) return null;
  const low = Math.max(1, min ?? max!);
  const high = Math.max(low, max ?? min!);
  return { value: Math.round((low + high) / 2), low, high, exact: false };
}

function industryText(company: LushaCompany): string | null {
  const industry = company.industry;
  if (!industry) return null;
  if (typeof industry === "string") return industry;
  return industry.name ?? industry.label ?? null;
}

export function websiteOf(domain: string | null | undefined): string | undefined {
  if (!domain) return undefined;
  const clean = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return clean ? `https://${clean}` : undefined;
}

/** A scoring input, or null when Lusha has no name or no staff count for the company. */
export function lushaToScoreInput(company: LushaCompany, fetchedAt: string): ScoreInput | null {
  const name = company.name?.trim();
  const staff = staffCount(company);
  if (!name || !staff) return null;

  const city = company.location?.city ?? company.location?.state ?? undefined;
  const confidence: Confidence = staff.exact ? "medium" : "low";
  const staffText = staff.exact ? `${staff.value} employees` : `${staff.low}–${staff.high} employees`;
  const industry = industryText(company);
  const evidence: Evidence[] = [
    {
      source: "lusha",
      ...(company.socialLinks?.linkedin ? { url: company.socialLinks.linkedin } : {}),
      finding: `Lusha lists ${staffText}${industry ? `, industry ${industry}` : ""}; split into technicians and office staff at one office seat per 7 technicians`,
      fetchedAt,
    },
  ];

  const techs = (n: number) => techniciansFromStaff(n);
  const seats = (n: number) => Math.max(1, Math.floor(n) - techniciansFromStaff(n));
  const technicians: Driver = { value: techs(staff.value), low: techs(staff.low), high: techs(staff.high), confidence, evidence };
  const officeSeats: Driver = { value: seats(staff.value), low: seats(staff.low), high: seats(staff.high), confidence, evidence: [] };

  const record: Company = {
    id: companyId(name, city ? slugify(city) : undefined),
    name,
    legalForm: legalFormFromName(name),
    address: {
      ...(city ? { city } : {}),
    },
    ...(websiteOf(company.domain) ? { website: websiteOf(company.domain) } : {}),
    sources: ["lusha"],
  };
  return { company: record, technicians, officeSeats };
}

/** The same company as a merge record (see lib/sources/record.ts). */
export function lushaToRecord(company: LushaCompany, fetchedAt: string): import("./record").SourceRecord | null {
  const name = company.name?.trim();
  if (!name) return null;
  const staff = staffCount(company) ?? undefined;
  const industry = industryText(company);
  const city = company.location?.city ?? company.location?.state ?? undefined;
  return {
    source: "lusha",
    name,
    legalForm: legalFormFromName(name),
    lushaId: company.id,
    address: city ? { city } : {},
    website: websiteOf(company.domain),
    linkedinUrl: company.socialLinks?.linkedin ?? undefined,
    staff,
    evidence: staff
      ? [
          {
            source: "lusha",
            ...(company.socialLinks?.linkedin ? { url: company.socialLinks.linkedin } : {}),
            finding: `Lusha lists ${staff.exact ? `${staff.value} employees` : `${staff.low}–${staff.high} employees`}${industry ? `, industry ${industry}` : ""}; split into technicians and office staff at one office seat per 7 technicians`,
            fetchedAt,
          },
        ]
      : [],
  };
}
