/**
 * The offer letter that goes out by fax: German, formal, built from the estimate.
 * Plain text for now; a PDF rendering comes with the Faxxing docs.
 */
import { config } from "../config";
import { dateDe, moneyDe } from "../format";
import type { ScoredCompany } from "../types";

export function offerSubject(company: ScoredCompany): string {
  return `Ihr Angebot für ${company.name}`;
}

export function offerLetter(company: ScoredCompany, now: Date): string {
  const { estimate } = company;
  const techs = estimate.technicians.value;
  const seats = estimate.officeSeats.value;
  const { basePerMonth, perExtraOfficeSeat, perTechnician } = config.pricing;
  const extraSeats = Math.max(0, seats - 1);

  const lines = [
    `${company.name}`,
    [company.address.zip, company.address.city].filter(Boolean).join(" "),
    "",
    `Berlin, ${dateDe(now.toISOString())}`,
    "",
    `Ihr Angebot: ${moneyDe(estimate.monthly)} im Monat`,
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    `vielen Dank für Ihre Anfrage. Für einen Betrieb wie ${company.name} mit ${techs} ${techs === 1 ? "Monteur" : "Monteuren"} und ${seats} ${seats === 1 ? "Büroarbeitsplatz" : "Büroarbeitsplätzen"} ergibt sich folgender Tarif:`,
    "",
    `  Erster Büroarbeitsplatz            ${moneyDe(basePerMonth)}`,
    `  ${String(extraSeats).padStart(2)} weitere Büroarbeitsplätze à ${moneyDe(perExtraOfficeSeat)}   ${moneyDe(perExtraOfficeSeat * extraSeats)}`,
    `  ${String(techs).padStart(2)} Monteure à ${moneyDe(perTechnician)}               ${moneyDe(perTechnician * techs)}`,
    `  Summe pro Monat                     ${moneyDe(estimate.monthly)}`,
    `  Summe pro Jahr                      ${moneyDe(estimate.acv)}`,
    "",
    "Alle Preise zuzüglich Umsatzsteuer, monatlich kündbar. Die Einrichtung ist kostenlos: Ihre Firmendaten sind bereits hinterlegt, und jeden Donnerstag richten wir neue Kunden gemeinsam in einer 45-minütigen Live-Session ein.",
    "",
    "Sie haben dieses Fax angefordert. Möchten Sie keine weiteren Unterlagen erhalten, genügt eine kurze Nachricht.",
    "",
    "Mit freundlichen Grüßen",
    "Ihr Team",
  ];
  return lines.join("\n");
}
