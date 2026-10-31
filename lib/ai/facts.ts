/** Company facts as plain text for the model. Numbers come from the scoring code, never from the model. */
import { MOTION_LABELS } from "../score/motion";
import type { ScoredCompany, ScoredRun } from "../types";

function euro(value: number): string {
  return `€${Math.round(value).toLocaleString("en-US")}`;
}

export function companyFacts(company: ScoredCompany, run: Pick<ScoredRun, "threshold">): string {
  const { estimate } = company;
  const lines = [
    `Company: ${company.name}`,
    `Legal form: ${company.legalForm}`,
    `City: ${[company.address.zip, company.address.city].filter(Boolean).join(" ") || "unknown"}`,
    `Website: ${company.website ?? "none found"}`,
    company.registeredAt ? `Registered: ${company.registeredAt}` : "Registered: unknown",
    `Listed in: ${company.sources.join(", ")}`,
    `Field technicians: ${estimate.technicians.value} (likely ${estimate.technicians.low}–${estimate.technicians.high}, ${estimate.technicians.confidence} confidence)`,
    `Office seats: ${estimate.officeSeats.value} (likely ${estimate.officeSeats.low}–${estimate.officeSeats.high}, ${estimate.officeSeats.confidence} confidence)`,
    `Monthly price at our pricing: ${euro(estimate.monthly)}`,
    `Predicted ACV: ${euro(estimate.acv)} (range ${euro(estimate.acvLow)}–${euro(estimate.acvHigh)})`,
    `Threshold: ${euro(run.threshold)}`,
    `Motion: ${MOTION_LABELS[company.motion]}. ${company.motionReason}`,
    "Evidence:",
  ];
  const evidence = [...estimate.technicians.evidence, ...estimate.officeSeats.evidence];
  if (evidence.length === 0) lines.push("- none");
  for (const ev of evidence) lines.push(`- [${ev.source}, ${ev.fetchedAt.slice(0, 10)}] ${ev.finding}`);
  return lines.join("\n");
}

/** The parts of a company that, when changed, should produce a new AI answer. */
export function factsFingerprint(company: ScoredCompany): unknown {
  return [company.id, company.motion, company.estimate.acv, company.estimate.technicians.evidence, company.estimate.officeSeats.evidence];
}
