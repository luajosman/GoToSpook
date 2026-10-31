import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LeadsTable, parseMotionFilter } from "@/components/LeadsTable";
import { MOTION_DOT } from "@/components/MotionPill";
import { SampleBadge } from "@/components/SampleBadge";
import { countByMotion, loadRun, type LoadedRun } from "@/lib/data";
import { count, dateEn, money } from "@/lib/format";
import { MOTION_LABELS } from "@/lib/score/motion";
import type { Motion } from "@/lib/types";

export const metadata: Metadata = { title: "Leads" };

type SearchParams = Promise<{ motion?: string | string[] }>;

const STAT_NOTES: Record<Motion, string> = {
  high_touch: "Call these",
  check: "Confirm the size",
  automated: "Letter and personal page",
  welcome: "New, say hello",
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
              {run.niche.label}. Threshold {money(run.threshold)} ACV. Scored {dateEn(run.generatedAt)}.
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

      </main>
    </>
  );
}
