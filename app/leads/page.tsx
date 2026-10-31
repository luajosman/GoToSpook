import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LeadsTable, parseMotionFilter } from "@/components/LeadsTable";
import { MOTION_DOT } from "@/components/MotionPill";
import { SampleBadge } from "@/components/SampleBadge";
import { config } from "@/lib/config";
import { countByMotion, loadRun, type LoadedRun } from "@/lib/data";
import { count, dateEn, money } from "@/lib/format";
import { pricingFormulaText } from "@/lib/score/formula";
import { MOTION_LABELS } from "@/lib/score/motion";
import type { Motion } from "@/lib/types";

export const metadata: Metadata = { title: "Leads" };

type SearchParams = Promise<{ motion?: string | string[] }>;

const STAT_NOTES: Record<Motion, string> = {
  high_touch: "Above the threshold, a named rep",
  check: "Signals disagree, needs a look",
  automated: "Self-serve, letter and fax on request",
  welcome: "Registered in the last 90 days",
};

async function FilteredLeads({ run, searchParams }: { run: LoadedRun; searchParams: SearchParams }) {
  const motion = parseMotionFilter((await searchParams).motion);
  return <LeadsTable run={run} motion={motion} />;
}

export default function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const run = loadRun();
  const counts = countByMotion(run);

  return (
    <>
      <AppHeader current="leads" />
      <main className="mx-auto w-full max-w-[1280px] px-8 pt-7 pb-16">
        <p className="mt-0 mb-1.5 text-sm text-muted">
          <Link href="/leads" className="text-muted no-underline">
            Leads
          </Link>{" "}
          / {run.niche.source}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">
                {count(run.companies.length)} leads scored
              </h1>
              {run.origin === "sample" && <SampleBadge />}
            </div>
            <p className="mt-2 mb-0 text-base text-muted">
              {run.niche.label}. Threshold {money(run.threshold)} ACV, {run.thresholdNote}. Scored {dateEn(run.generatedAt)}.
            </p>
          </div>
          <Link
            href="/pipeline"
            className="inline-flex min-h-12 items-center rounded-[10px] border border-line-strong bg-white px-[18px] text-base font-medium text-ink no-underline hover:text-ink"
          >
            Pipeline overview
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          {(["high_touch", "check", "automated", "welcome"] as Motion[]).map((m) => (
            <div key={m} className="flex-[1_1_220px] border-t border-line py-[18px]">
              <p className="m-0 flex items-center gap-2 text-[13px] font-medium text-muted">
                <span aria-hidden="true" className={`h-[9px] w-[9px] rounded-full ${MOTION_DOT[m]}`} />
                {MOTION_LABELS[m]}
              </p>
              <p className="mt-1 mb-0 text-[28px] leading-[1.2] font-medium tabular-nums">{count(counts[m])}</p>
              <p className="mt-1 mb-0 text-[15px] text-muted">{STAT_NOTES[m]}</p>
            </div>
          ))}
        </div>

        <section aria-labelledby="leads-heading" className="mt-5 border-t border-line pt-[22px] pb-2">
          <Suspense fallback={<LeadsTable run={run} motion="all" />}>
            <FilteredLeads run={run} searchParams={searchParams} />
          </Suspense>
        </section>

        <div className="mt-5 flex flex-wrap items-start gap-5">
          <section aria-labelledby="pricing-heading" className="min-w-0 flex-[999_1_520px] border-t border-line py-[22px]">
            <h2 id="pricing-heading" className="m-0 text-base font-semibold">
              Pricing for this niche
            </h2>
            <p className="mt-3 mb-0 text-[19px] leading-[1.6] font-medium tabular-nums">{pricingFormulaText()}</p>
            <p className="mt-2 mb-0 text-[15px] text-muted">
              The example customer&rsquo;s plan: the first office seat, every further seat and every field technician have
              their own price. When office staff is unknown, one seat per {config.pricing.techniciansPerOfficeSeat} technicians is assumed and the confidence drops.
            </p>
          </section>
          <section aria-labelledby="next-heading" className="min-w-0 flex-[1_1_320px] border-t border-line py-[22px]">
            <h2 id="next-heading" className="m-0 text-base font-semibold">
              What happens next
            </h2>
            <ol className="mt-3 mb-0 flex list-decimal flex-col gap-1.5 pl-[22px] text-muted">
              <li>High-touch accounts get a research brief and a named owner</li>
              <li>Automated companies get a personal page, a letter and a fax on request</li>
              <li>New companies get a congratulations letter and a warm intro</li>
              <li>Check leads wait for a person to confirm the team size</li>
            </ol>
          </section>
        </div>
      </main>
    </>
  );
}
