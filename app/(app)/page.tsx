import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { AskBox } from "@/components/ai/AskBox";
import { MOTION_BAR, MOTION_DOT, MotionPill } from "@/components/MotionPill";
import { NoDataBadge, NoDataNotice } from "@/components/NoData";
import { countByMotion, loadRun } from "@/lib/data";
import { count, dateEn, initialsOf, money } from "@/lib/format";
import { MOTION_LABELS } from "@/lib/score/motion";
import type { Confidence, Motion } from "@/lib/types";

export const metadata: Metadata = { title: "Overview" };

const MOTIONS: Motion[] = ["high_touch", "check", "automated", "welcome"];
const CONFIDENCE: Array<{ key: Confidence; label: string }> = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex-[1_1_200px] border-t border-line pt-4">
      <p className="m-0 text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1 mb-0 text-[28px] leading-[1.2] font-medium tabular-nums">{value}</p>
      <p className="mt-0.5 mb-0 text-sm text-muted">{note}</p>
    </div>
  );
}

export default function OverviewPage() {
  const run = loadRun();
  const counts = countByMotion(run);
  const total = run.companies.length;
  const acvOf = (m?: Motion) =>
    run.companies.filter((c) => !m || c.motion === m).reduce((sum, c) => sum + c.estimate.acv, 0);
  const totalAcv = acvOf();
  const confidence = Object.fromEntries(
    CONFIDENCE.map(({ key }) => [key, run.companies.filter((c) => c.estimate.confidence === key).length]),
  ) as Record<Confidence, number>;
  const withWebsite = run.companies.filter((c) => c.website).length;
  const evidence = run.companies.reduce(
    (sum, c) => sum + c.estimate.technicians.evidence.length + c.estimate.officeSeats.evidence.length,
    0,
  );
  const biggest = run.companies.slice(0, 5);
  const share = (n: number) => (total ? `${((n / total) * 100).toFixed(2)}%` : "0%");

  return (
    <>
      <AppHeader current="overview" />
      <main className="mx-auto w-full max-w-[1280px] px-8 pt-8 pb-16">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">Overview</h1>
          <NoDataBadge run={run} />
        </div>
        <p className="mt-2 mb-0 text-base text-muted">
          {run.origin === "empty" ? run.niche.label : `${run.niche.label}, scored ${dateEn(run.generatedAt)}.`}
        </p>
        <NoDataNotice run={run} />

        <div className="mt-7 flex flex-wrap gap-4">
          <Stat label="Companies scored" value={count(total)} note={`from the ${run.niche.source}`} />
          <Stat label="Predicted ACV, all companies" value={money(totalAcv)} note="a year, if every company signed" />
          <Stat label="High-touch ACV" value={money(acvOf("high_touch"))} note={`${count(counts.high_touch)} accounts for the reps`} />
          <Stat label="Threshold" value={money(run.threshold)} note={run.thresholdNote} />
        </div>

        <section aria-labelledby="split-heading" className="mt-8 border-t border-line pt-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 id="split-heading" className="m-0 text-base font-semibold">
              Companies by motion
            </h2>
            <Link href="/pipeline" className="text-[15px] font-semibold no-underline">
              Open the pipeline
            </Link>
          </div>
          <div aria-hidden="true" className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-line-soft">
            {MOTIONS.filter((m) => counts[m] > 0).map((m) => (
              <span key={m} className={`h-full ${MOTION_BAR[m]}`} style={{ width: share(counts[m]) }} />
            ))}
          </div>
          <ul className="mt-4 mb-0 grid list-none grid-cols-1 gap-x-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {MOTIONS.map((m) => (
              <li key={m} className="border-t border-line-soft py-3">
                <Link href={`/leads?motion=${m}`} className="block text-ink no-underline hover:text-ink">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
                    <span aria-hidden="true" className={`h-[9px] w-[9px] rounded-full ${MOTION_DOT[m]}`} />
                    {MOTION_LABELS[m]}
                  </span>
                  <span className="mt-1 flex items-baseline justify-between gap-3">
                    <span className="text-[22px] font-medium tabular-nums">{count(counts[m])}</span>
                    <span className="text-sm text-muted tabular-nums">{money(acvOf(m))} ACV</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <AskBox />

        <div className="mt-8 flex flex-wrap items-start gap-8">
          <section aria-labelledby="biggest-heading" className="min-w-0 flex-[999_1_560px] border-t border-line pt-6">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 id="biggest-heading" className="m-0 text-base font-semibold">
                Biggest accounts
              </h2>
              <Link href="/leads" className="text-[15px] font-semibold no-underline">
                All leads
              </Link>
            </div>
            <ul className="mt-3 mb-0 list-none p-0">
              {biggest.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-t border-line-soft py-2.5">
                  <span aria-hidden="true" className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-track text-[13px] font-semibold text-muted">
                    {initialsOf(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/leads/${c.id}`} className="block truncate font-semibold text-ink no-underline hover:text-ink hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-sm text-muted">{c.address.city}</span>
                  </span>
                  <MotionPill motion={c.motion} />
                  <span className="w-[76px] flex-none text-right font-semibold tabular-nums">{money(c.estimate.acv)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="data-heading" className="min-w-0 flex-[1_1_320px] border-t border-line pt-6">
            <h2 id="data-heading" className="m-0 text-base font-semibold">
              Data quality
            </h2>
            <dl className="mt-3 mb-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[15px]">
              {CONFIDENCE.map(({ key, label }) => (
                <div key={key} className="contents">
                  <dt className="text-muted">{label} confidence</dt>
                  <dd className="m-0 text-right font-semibold tabular-nums">{count(confidence[key])}</dd>
                </div>
              ))}
              <dt className="text-muted">With a website</dt>
              <dd className="m-0 text-right font-semibold tabular-nums">
                {count(withWebsite)} of {count(total)}
              </dd>
              <dt className="text-muted">Evidence items</dt>
              <dd className="m-0 text-right font-semibold tabular-nums">{count(evidence)}</dd>
              <dt className="text-muted">Data</dt>
              <dd className="m-0 text-right font-semibold">{run.origin === "empty" ? "None yet" : "Lusha"}</dd>
            </dl>
          </section>
        </div>
      </main>
    </>
  );
}
