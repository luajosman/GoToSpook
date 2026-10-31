import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { MOTION_DOT } from "@/components/MotionPill";
import { SampleBadge } from "@/components/SampleBadge";
import { countByMotion, loadRun } from "@/lib/data";
import { count, money } from "@/lib/format";
import { MOTION_LABELS } from "@/lib/score/motion";
import type { Confidence, Motion } from "@/lib/types";

export const metadata: Metadata = { title: "Pipeline" };

const COLUMN_SIZE = 10;

/** One column per motion, with the action that column is for. */
const COLUMNS: Array<{ motion: Motion; action: string; accent: string; personalPage?: boolean }> = [
  { motion: "high_touch", action: "Call next", accent: "border-brand" },
  { motion: "check", action: "Confirm the team size", accent: "border-mark" },
  { motion: "automated", action: "Letter and personal page", accent: "border-automated", personalPage: true },
  { motion: "welcome", action: "Say hello", accent: "border-amber", personalPage: true },
];

const CONFIDENCE: Record<Confidence, string> = { high: "High", medium: "Medium", low: "Low" };

export default function PipelinePage() {
  const run = loadRun();
  const counts = countByMotion(run);

  return (
    <>
      <AppHeader current="pipeline" />
      <main className="mx-auto w-full max-w-[1280px] px-8 pt-8 pb-16">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">Pipeline</h1>
          {run.origin === "sample" && <SampleBadge />}
        </div>
        <p className="mt-2 mb-0 text-base text-muted">Every company in its motion, biggest first. Open one to see why and what to do.</p>

        <div className="mt-7 grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const companies = run.companies.filter((c) => c.motion === col.motion);
            const rows = companies.slice(0, COLUMN_SIZE);
            const acv = companies.reduce((sum, c) => sum + c.estimate.acv, 0);
            return (
              <section key={col.motion} aria-labelledby={`col-${col.motion}`} className={`min-w-0 border-t-[3px] pt-4 ${col.accent}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id={`col-${col.motion}`} className="m-0 flex items-center gap-2 text-base font-semibold">
                    <span aria-hidden="true" className={`h-[9px] w-[9px] rounded-full ${MOTION_DOT[col.motion]}`} />
                    {MOTION_LABELS[col.motion]}
                  </h2>
                  <span className="text-[15px] font-semibold tabular-nums">{count(counts[col.motion])}</span>
                </div>
                <p className="mt-0.5 mb-0 flex justify-between gap-3 text-sm text-muted">
                  <span>{col.action}</span>
                  <span className="tabular-nums">{money(acv)}</span>
                </p>
                {rows.length === 0 ? (
                  <p className="mt-3 mb-0 border-t border-line-soft pt-3 text-[15px] text-muted">Nobody here right now.</p>
                ) : (
                  <ul className="mt-3 mb-0 list-none p-0">
                    {rows.map((c) => (
                      <li key={c.id} className="border-t border-line-soft py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link href={`/leads/${c.id}`} className="min-w-0 truncate font-semibold text-ink no-underline hover:text-ink hover:underline">
                            {c.name}
                          </Link>
                          <span className="flex-none font-semibold tabular-nums">{money(c.estimate.acv)}</span>
                        </div>
                        <div className="mt-0.5 flex items-baseline justify-between gap-3 text-sm text-muted">
                          <span className="truncate">
                            {c.address.city} · {CONFIDENCE[c.estimate.confidence]} confidence
                          </span>
                          {col.personalPage && (
                            <Link href={`/p/${c.id}`} className="flex-none font-semibold no-underline">
                              Page
                            </Link>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {companies.length > rows.length && (
                  <Link href={`/leads?motion=${col.motion}`} className="mt-1 inline-flex min-h-11 items-center text-[15px] font-semibold no-underline">
                    See all {count(companies.length)}
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
