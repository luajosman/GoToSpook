import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FaxForm } from "@/components/FaxForm";
import { Logo } from "@/components/Logo";
import { config } from "@/lib/config";
import { findCompany, loadRun, type LoadedRun } from "@/lib/data";
import { moneyDe } from "@/lib/format";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const company = findCompany(loadRun(), slug);
  return { title: company ? `Ihr Angebot, ${company.name}` : "Persönliche Seite" };
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex-[1_1_160px] border-t border-line pt-4">
      <p className="m-0 text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1 mb-0 text-[28px] leading-[1.2] font-medium tabular-nums">{value}</p>
      {note && <p className="mt-0.5 mb-0 text-sm text-muted">{note}</p>}
    </div>
  );
}

async function PersonalPage({ run, params }: { run: LoadedRun; params: Params }) {
  const { slug } = await params;
  const company = findCompany(run, slug);
  if (!company) notFound();

  const { estimate } = company;
  const techs = estimate.technicians.value;
  const seats = estimate.officeSeats.value;
  const extraSeats = Math.max(0, seats - 1);
  const { basePerMonth, perExtraOfficeSeat, perTechnician, monthsPerYear } = config.pricing;
  const welcome = company.motion === "welcome";

  const row = "border-t border-line-soft py-2.5";

  return (
    <main className="mx-auto w-full max-w-[880px] px-8 pt-10 pb-20">
      <p className="m-0 text-[13px] font-medium text-muted">{welcome ? "Willkommen" : "Persönliche Seite"} · {company.name}</p>
      <h1 className="mt-2 mb-0 text-[32px] leading-[1.2] font-semibold tracking-[-0.02em]">
        {welcome
          ? `Herzlichen Glückwunsch zur Gründung, ${company.name}`
          : `Für ${company.name} gemacht: ${techs} ${techs === 1 ? "Monteur" : "Monteure"}, ${seats} ${seats === 1 ? "Büroarbeitsplatz" : "Büroarbeitsplätze"}`}
      </h1>
      <p className="mt-3 mb-0 max-w-[720px] text-[17px] text-ink-soft">
        {welcome
          ? `Für den Start haben wir Ihnen einen Tarif für ${techs} ${techs === 1 ? "Monteur" : "Monteure"} vorbereitet: ${moneyDe(estimate.monthly)} im Monat. Er wächst mit Ihrem Team.`
          : `Ihr voraussichtlicher Tarif: ${moneyDe(estimate.monthly)} im Monat. Ihre Firmendaten sind bereits hinterlegt, Sie können sofort starten.`}
      </p>

      <div className="mt-8 flex flex-wrap gap-4">
        <Stat label="Ihr Tarif" value={moneyDe(estimate.monthly)} note="im Monat, zzgl. USt." />
        <Stat label="Pro Jahr" value={moneyDe(estimate.acv)} note="monatlich kündbar" />
        <Stat label="Monteure" value={String(techs)} note="laut öffentlichen Angaben" />
        <Stat label="Büroarbeitsplätze" value={String(seats)} note={extraSeats === 0 ? "einer ist inklusive" : "der erste ist inklusive"} />
      </div>

      <section aria-labelledby="tarif-heading" className="mt-10 border-t border-line pt-6">
        <h2 id="tarif-heading" className="m-0 text-base font-semibold">
          So setzt sich Ihr Tarif zusammen
        </h2>
        <table className="mt-3 w-full max-w-[560px] border-collapse text-base tabular-nums">
          <tbody>
            <tr>
              <th scope="row" className={`${row} text-left font-normal`}>
                Erster Büroarbeitsplatz
              </th>
              <td className={`${row} text-right`}>{moneyDe(basePerMonth)}</td>
            </tr>
            <tr>
              <th scope="row" className={`${row} text-left font-normal`}>
                {extraSeats} {extraSeats === 1 ? "weiterer Büroarbeitsplatz" : "weitere Büroarbeitsplätze"} à {moneyDe(perExtraOfficeSeat)}
              </th>
              <td className={`${row} text-right`}>{moneyDe(perExtraOfficeSeat * extraSeats)}</td>
            </tr>
            <tr>
              <th scope="row" className={`${row} text-left font-normal`}>
                {techs} {techs === 1 ? "Monteur" : "Monteure"} à {moneyDe(perTechnician)}
              </th>
              <td className={`${row} text-right`}>{moneyDe(perTechnician * techs)}</td>
            </tr>
            <tr>
              <th scope="row" className="border-t border-line-strong py-2.5 text-left font-semibold">
                Pro Monat
              </th>
              <td className="border-t border-line-strong py-2.5 text-right font-semibold">{moneyDe(estimate.monthly)}</td>
            </tr>
            <tr>
              <th scope="row" className={`${row} text-left font-semibold`}>
                Pro Jahr (× {monthsPerYear})
              </th>
              <td className={`${row} text-right font-semibold`}>{moneyDe(estimate.acv)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 mb-0 text-sm text-muted">
          Die Teamgröße stammt aus öffentlichen Angaben. Stimmt sie nicht? Dann passen wir das Angebot gern an.
        </p>
      </section>

      <section aria-labelledby="bekommen-heading" className="mt-8 border-t border-line pt-6">
        <h2 id="bekommen-heading" className="m-0 text-base font-semibold">
          Was Sie bekommen
        </h2>
        <ul className="mt-3 mb-0 list-none p-0 text-[15px]">
          {[
            ["Testzugang mit Ihren Firmendaten", "Firmenname, Gewerk und Team sind schon eingetragen. Kein Verkaufsgespräch nötig."],
            ["Einrichtung in der Live-Session", "Jeden Donnerstag richten wir neue Kunden gemeinsam in 45 Minuten ein."],
            ["Eine Referenz aus Ihrer Größenklasse", "Ein Betrieb mit ähnlichem Team erzählt, wie der Umstieg lief."],
            ["Ihr Angebot per Fax", "Auf Wunsch kommt das Angebot innerhalb von Sekunden per Fax, zum Abheften."],
          ].map(([title, text]) => (
            <li key={title} className="border-t border-line-soft py-3">
              <span className="block font-semibold">{title}</span>
              <span className="block text-muted">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fax-heading" className="mt-8 border-t border-line pt-6">
        <h2 id="fax-heading" className="m-0 text-base font-semibold">
          Angebot per Fax erhalten
        </h2>
        <p className="mt-1 mb-0 text-[15px] text-muted">
          Geben Sie Ihre Faxnummer ein, und das Angebot für {company.name} kommt innerhalb von Sekunden an. Wir faxen nie
          unaufgefordert.
        </p>
        <FaxForm companyId={company.id} companyName={company.name} />
      </section>

      <footer className="mt-12 border-t border-line pt-5 text-sm text-muted">
        <p className="m-0">
          Diese Seite wurde aus öffentlichen Angaben erstellt und ist nur für {company.name} gedacht. Keine weiteren Briefe
          gewünscht? Eine kurze Nachricht genügt.
        </p>
      </footer>
    </main>
  );
}

export default function Page({ params }: { params: Params }) {
  const run = loadRun();
  return (
    <div lang="de">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[880px] items-center gap-2.5 px-8">
          <Logo />
          <span className="text-lg font-semibold tracking-[-0.01em]">ACV Router</span>
          <span className="ml-auto text-sm text-muted">Ihr persönliches Angebot</span>
        </div>
      </header>
      <Suspense fallback={<main className="mx-auto w-full max-w-[880px] px-8 pt-10 pb-20" />}>
        <PersonalPage run={run} params={params} />
      </Suspense>
    </div>
  );
}
