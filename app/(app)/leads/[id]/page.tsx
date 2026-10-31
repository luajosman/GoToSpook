import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MotionPill } from "@/components/MotionPill";
import { OutreachButtons } from "@/components/outreach/OutreachButtons";
import { OutreachLog } from "@/components/outreach/OutreachLog";
import { listEvents } from "@/lib/outreach/store";
import { BriefingPanel } from "@/components/ai/BriefingPanel";
import { WelcomePanel } from "@/components/ai/WelcomePanel";
import { cachedBriefing } from "@/lib/ai/briefing";
import { cachedWelcome } from "@/lib/ai/welcome";
import { scaleMaxFor } from "@/components/LeadsTable";
import { config } from "@/lib/config";
import { findCompany, loadRun, type LoadedRun } from "@/lib/data";
import { dateEn, initialsOf, money, moneyK, plural } from "@/lib/format";
import { MOTION_LABELS } from "@/lib/score/motion";
import type { Confidence, Driver, EvidenceSource, LegalForm, Motion, ScoredCompany } from "@/lib/types";

type Params = Promise<{ id: string }>;

const CONFIDENCE: Record<Confidence, string> = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  website: "Website",
  impressum: "Impressum",
  register: "Trade register",
  innung: "Guild member list",
  lusha: "Lusha",
  needle: "Needle lead list",
  jobs: "Job postings",
  manual: "Entered by a rep",
};

const SOURCE_ORIGIN: Record<EvidenceSource, string> = {
  website: "Company website, read with Needle",
  impressum: "Impressum, read with Needle",
  register: "Trade register, via the register API",
  innung: "SHK guild member list",
  lusha: "Lusha company data",
  needle: "Needle lead list",
  jobs: "Job boards",
  manual: "Rep corrections",
};

const LEGAL_FORM: Record<LegalForm, string> = {
  GmbH: "GmbH",
  "GmbH & Co. KG": "GmbH & Co. KG",
  UG: "UG (haftungsbeschränkt)",
  "e.K.": "e.K.",
  sole_trader: "Sole trader",
  unknown: "Unknown",
};

const NEXT_STEP: Record<Motion, { step: string; owner: string }> = {
  high_touch: {
    step: "Research brief for the team, then a personal video and call from a named rep, and a demo with their own data.",
    owner: config.capacity.repNames.join(" or "),
  },
  automated: {
    step: "Personal letter with a QR code to their page. The offer goes out by fax only when they ask for it there.",
    owner: "Automation",
  },
  welcome: {
    step: "Congratulations letter with a starter offer, then a warm intro through a partner they already trust.",
    owner: "Partnerships",
  },
  check: {
    step: "A person confirms the team size from a call or the website, then the company is routed again.",
    owner: config.capacity.repNames[0],
  },
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const company = findCompany(loadRun(), id);
  return { title: company ? company.name : "Lead" };
}

function pct(value: number, max: number): number {
  return Math.min(Math.max(value / max, 0), 1) * 100;
}

function rangeText(driver: Driver, unit: [string, string]): string {
  const value = `${driver.value} ${plural(driver.value, unit[0], unit[1])}`;
  return driver.low === driver.high ? value : `${value}, likely ${driver.low} to ${driver.high}`;
}

function EvidenceRows({ driver, derivedNote }: { driver: Driver; derivedNote?: string }) {
  if (driver.evidence.length === 0) {
    return (
      <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft py-3.5">
        <span className="flex-[0_0_200px] font-semibold">Derived</span>
        <span className="min-w-0 flex-[1_1_260px] text-ink-soft">{derivedNote}</span>
        <span className="flex-[0_1_200px] text-sm text-muted">Lowers the confidence</span>
      </li>
    );
  }
  return (
    <>
      {driver.evidence.map((ev, i) => (
        <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft py-3.5">
          <span className="flex-[0_0_200px] font-semibold">{SOURCE_LABEL[ev.source]}</span>
          <span className="min-w-0 flex-[1_1_260px] text-ink-soft">{ev.finding}</span>
          <span className="flex-[0_1_200px] text-sm text-muted">
            {ev.url ? (
              <a href={ev.url} target="_blank" rel="noreferrer" className="text-muted hover:text-ink">
                Fetched {dateEn(ev.fetchedAt)}
              </a>
            ) : (
              <>Fetched {dateEn(ev.fetchedAt)}</>
            )}
          </span>
        </li>
      ))}
    </>
  );
}

function sourcesOf(company: ScoredCompany): Array<{ label: string; when: string }> {
  const seen = new Map<EvidenceSource, string>();
  for (const driver of [company.estimate.technicians, company.estimate.officeSeats]) {
    for (const ev of driver.evidence) {
      const prev = seen.get(ev.source);
      if (!prev || ev.fetchedAt > prev) seen.set(ev.source, ev.fetchedAt);
    }
  }
  const rows = [...seen.entries()].map(([source, when]) => ({ label: SOURCE_ORIGIN[source], when: `Fetched ${dateEn(when)}` }));
  if (company.sources.includes("innung") && !seen.has("innung")) rows.push({ label: SOURCE_ORIGIN.innung, when: "Imported" });
  if (company.sources.includes("register") && !seen.has("register")) rows.push({ label: SOURCE_ORIGIN.register, when: "Fetched" });
  return rows;
}

async function LeadDetail({ run, params }: { run: LoadedRun; params: Params }) {
  const { id } = await params;
  const company = findCompany(run, id);
  if (!company) notFound();

  const { estimate } = company;
  const max = scaleMaxFor(run);
  const extraSeats = Math.max(0, estimate.officeSeats.value - 1);
  const techs = estimate.technicians.value;
  const { basePerMonth, perExtraOfficeSeat, perTechnician, monthsPerYear } = config.pricing;
  const next = NEXT_STEP[company.motion];

  const rangeNote =
    estimate.acvLow === estimate.acvHigh
      ? "per year"
      : `per year, likely between ${money(estimate.acvLow)} and ${money(estimate.acvHigh)}`;

  return (
    <main className="mx-auto w-full max-w-[1280px] px-8 pt-7 pb-16">
      <p className="mt-0 mb-1.5 text-sm text-muted">
        <Link href="/leads" className="text-muted no-underline">
          Leads
        </Link>{" "}
        /{" "}
        <Link href="/leads" className="text-muted no-underline">
          {run.niche.source}
        </Link>{" "}
        / {company.name}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="inline-flex h-14 w-14 flex-none items-center justify-center rounded-[14px] bg-track text-lg font-semibold text-muted">
            {initialsOf(company.name)}
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">{company.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <MotionPill motion={company.motion} />
              <span className="text-[15px] font-semibold">{CONFIDENCE[estimate.confidence]}</span>
              <span className="text-[15px] text-muted">
                {company.address.city}, from the {run.niche.source}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <OutreachButtons companyId={company.id} companyName={company.name} phone={company.phone} defaultCallTo={config.outreach.defaultCallTo || undefined} />
          <Link
            href="/leads"
            className="inline-flex min-h-12 items-center rounded-[10px] border border-line-strong bg-white px-[18px] text-base font-medium text-ink no-underline hover:text-ink"
          >
            Back to list
          </Link>
          <Link
            href={`/p/${company.id}`}
            className="inline-flex min-h-12 items-center rounded-[10px] border border-line-strong bg-white px-[18px] text-base font-medium text-ink no-underline hover:text-ink"
          >
            Open their personal page
          </Link>
        </div>
      </div>

      <div className="mt-[26px] flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <section aria-labelledby="acv-heading" className="border-t border-line pt-[22px] pb-[26px]">
            <h2 id="acv-heading" className="m-0 text-[13px] font-medium text-muted">
              Predicted ACV
            </h2>
            <p className="mt-1.5 mb-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[40px] leading-[1.1] font-medium tracking-[-0.02em] tabular-nums">{money(estimate.acv)}</span>
              <span className="text-base text-muted">{rangeNote}</span>
            </p>
            <div className="mt-[26px] max-w-[640px]">
              <div aria-hidden="true" className="relative h-3 rounded-full bg-line-soft">
                {estimate.acvLow !== estimate.acvHigh && (
                  <span
                    className="absolute inset-y-0 rounded-full bg-brand-line"
                    style={{ left: `${pct(estimate.acvLow, max)}%`, width: `${pct(estimate.acvHigh, max) - pct(estimate.acvLow, max)}%` }}
                  />
                )}
                <span className="absolute -top-1.5 -bottom-1.5 w-0.5 -ml-px rounded-[1px] bg-ink" style={{ left: `${pct(run.threshold, max)}%` }} />
                <span className="absolute -top-1.5 -bottom-1.5 w-1 -ml-0.5 rounded-sm bg-brand" style={{ left: `${pct(estimate.acv, max)}%` }} />
              </div>
              <div aria-hidden="true" className="relative mt-2.5 h-5 text-[13px] text-muted tabular-nums">
                <span className="absolute left-0">€0</span>
                <span className="absolute -translate-x-1/2 font-semibold text-ink" style={{ left: `${pct(run.threshold, max)}%` }}>
                  {moneyK(run.threshold)}
                </span>
                {run.threshold * 2 < max * 0.9 && (
                  <span className="absolute -translate-x-1/2" style={{ left: `${pct(run.threshold * 2, max)}%` }}>
                    {moneyK(run.threshold * 2)}
                  </span>
                )}
                <span className="absolute right-0">{moneyK(max)}</span>
              </div>
              <p className="mt-2 mb-0 text-sm text-muted">The dark mark is your threshold of {money(run.threshold)}.</p>
            </div>
            <table className="mt-6 w-full max-w-[640px] border-collapse text-base tabular-nums">
              <caption className="pb-2 text-left text-[13px] font-medium text-muted">How we got there</caption>
              <tbody>
                <tr>
                  <th scope="row" className="border-t border-line-soft py-2.5 text-left font-normal">
                    First office seat
                  </th>
                  <td className="border-t border-line-soft py-2.5 text-right">{money(basePerMonth)}</td>
                </tr>
                <tr>
                  <th scope="row" className="border-t border-line-soft py-2.5 text-left font-normal">
                    {extraSeats} more office {plural(extraSeats, "seat", "seats")} × {money(perExtraOfficeSeat)}
                  </th>
                  <td className="border-t border-line-soft py-2.5 text-right">{money(perExtraOfficeSeat * extraSeats)}</td>
                </tr>
                <tr>
                  <th scope="row" className="border-t border-line-soft py-2.5 text-left font-normal">
                    {techs} field {plural(techs, "tech", "techs")} × {money(perTechnician)}
                  </th>
                  <td className="border-t border-line-soft py-2.5 text-right">{money(perTechnician * techs)}</td>
                </tr>
                <tr>
                  <th scope="row" className="border-t border-line-strong py-2.5 text-left font-semibold">
                    Per month
                  </th>
                  <td className="border-t border-line-strong py-2.5 text-right font-semibold">{money(estimate.monthly)}</td>
                </tr>
                <tr>
                  <th scope="row" className="border-t border-line-soft py-2.5 text-left font-semibold">
                    Per year (× {monthsPerYear})
                  </th>
                  <td className="border-t border-line-soft py-2.5 text-right font-semibold">{money(estimate.acv)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section aria-labelledby="evidence-heading" className="border-t border-line pt-[22px] pb-3">
            <h2 id="evidence-heading" className="m-0 text-base font-semibold">
              Evidence
            </h2>
            <p className="mt-1 mb-0 text-[15px] text-muted">
              Field technicians: {rangeText(estimate.technicians, ["technician", "technicians"])}, {estimate.technicians.confidence} confidence.
            </p>
            <ul className="mt-3 mb-0 list-none p-0">
              <EvidenceRows driver={estimate.technicians} />
            </ul>
            <p className="mt-5 mb-0 text-[15px] text-muted">
              Office seats: {rangeText(estimate.officeSeats, ["seat", "seats"])}, {estimate.officeSeats.confidence} confidence.
            </p>
            <ul className="mt-3 mb-0 list-none p-0">
              <EvidenceRows
                driver={estimate.officeSeats}
                derivedNote={`No office staff found, so one seat per ${config.pricing.techniciansPerOfficeSeat} technicians is assumed: ${estimate.officeSeats.value} ${plural(estimate.officeSeats.value, "seat", "seats")} for ${techs} technicians.`}
              />
            </ul>
          </section>

          <section aria-labelledby="sources-heading" className="border-t border-line py-[22px]">
            <h2 id="sources-heading" className="m-0 text-base font-semibold">
              Where this data came from
            </h2>
            <p className="mt-1 mb-0 text-[15px] text-muted">Only business information, from public sources. Every external call is cached.</p>
            <ul className="mt-3 mb-0 list-none p-0 text-[15px]">
              {sourcesOf(company).map((s) => (
                <li key={s.label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line-soft py-2.5">
                  <span className="font-semibold">{s.label}</span>
                  <span className="text-muted">{s.when}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <section aria-labelledby="motion-heading" className="border-t border-line py-[22px]">
            <h2 id="motion-heading" className="m-0 flex items-center gap-2.5 text-base font-semibold">
              Motion
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <MotionPill motion={company.motion} />
              <span className="text-[15px] font-semibold">{MOTION_LABELS[company.motion]}</span>
            </div>
            <p className="mt-2 mb-0 text-[15px] text-ink-soft">{company.motionReason}</p>
            <h3 className="mt-[18px] mb-0 text-sm font-semibold text-muted">Next step</h3>
            <p className="mt-1 mb-0 text-[15px] text-ink-soft">{next.step}</p>
            <dl className="mt-3.5 mb-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
              <dt className="text-muted">Owner</dt>
              <dd className="m-0">{next.owner}</dd>
              <dt className="text-muted">Personal page</dt>
              <dd className="m-0">
                <Link href={`/p/${company.id}`} className="font-semibold no-underline">
                  /p/{company.id}
                </Link>
              </dd>
            </dl>
          </section>

          <OutreachLog companyId={company.id} events={listEvents(company.id)} />
          <BriefingPanel companyId={company.id} initial={cachedBriefing(company)} />
          {company.motion === "welcome" && <WelcomePanel companyId={company.id} initial={cachedWelcome(company)} />}

          <section aria-labelledby="company-heading" className="border-t border-line py-[22px]">
            <h2 id="company-heading" className="m-0 text-base font-semibold">
              Company
            </h2>
            <dl className="mt-3.5 mb-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
              <dt className="text-muted">Legal form</dt>
              <dd className="m-0">{LEGAL_FORM[company.legalForm]}</dd>
              {company.registerId && (
                <>
                  <dt className="text-muted">Register</dt>
                  <dd className="m-0 tabular-nums">
                    {company.registerId}
                    {company.registeredAt ? `, since ${dateEn(company.registeredAt)}` : ""}
                  </dd>
                </>
              )}
              <dt className="text-muted">Address</dt>
              <dd className="m-0">
                {[company.address.street, [company.address.zip, company.address.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
              </dd>
              <dt className="text-muted">Website</dt>
              <dd className="m-0">
                {company.website ? (
                  <a href={company.website} target="_blank" rel="noreferrer" className="break-all no-underline">
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-muted">None found</span>
                )}
              </dd>
              <dt className="text-muted">Listed in</dt>
              <dd className="m-0">{company.sources.map((s) => ({ innung: "guild member list", register: "trade register", lusha: "Lusha", needle: "Needle" })[s]).join(", ")}</dd>
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function LeadPage({ params }: { params: Params }) {
  const run = loadRun();
  return (
    <>
      <AppHeader current="leads" />
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-[1280px] px-8 pt-7 pb-16">
            <p className="mt-0 mb-1.5 text-sm text-muted">Leads / {run.niche.source}</p>
          </main>
        }
      >
        <LeadDetail run={run} params={params} />
      </Suspense>
    </>
  );
}
