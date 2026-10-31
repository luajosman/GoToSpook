import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { MOTION_DOT, MotionPill } from "@/components/MotionPill";
import { SampleBadge } from "@/components/SampleBadge";
import { countByMotion, loadRun } from "@/lib/data";
import { count, initialsOf, money } from "@/lib/format";
import { MOTION_LABELS } from "@/lib/score/motion";
import type { Motion } from "@/lib/types";

export const metadata: Metadata = { title: "Pipeline" };

const UP_NEXT_SIZE = 5;

/** What to do with each motion, in the order a rep works through them. */
const QUEUES: Array<{ motion: Motion; title: string; personalPage?: boolean }> = [
  { motion: "high_touch", title: "Call next" },
  { motion: "check", title: "Confirm the team size" },
  { motion: "welcome", title: "Say hello", personalPage: true },
  { motion: "automated", title: "Letters and personal pages", personalPage: true },
];

const TILES: Motion[] = ["high_touch", "check", "automated", "welcome"];

export default function PipelinePage() {
  const run = loadRun();
  const counts = countByMotion(run);

  return (
    <>
      <AppHeader current="pipeline" />
      <main className="mx-auto w-full max-w-[1280px] px-8 pt-8 pb-16">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">Your GTM pipeline</h1>
          {run.origin === "sample" && <SampleBadge />}
        </div>
        <p className="mt-2 mb-0 text-base text-muted">
          {count(run.companies.length)} companies scored, threshold {money(run.threshold)} ACV.
        </p>

        <div className="mt-7 flex flex-wrap gap-4">
          {TILES.map((m) => (
            <Link
              key={m}
              href={`/leads?motion=${m}`}
              className="group flex-[1_1_200px] border-t border-line pt-4 pb-2 text-ink no-underline hover:border-ink hover:text-ink"
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
                <span aria-hidden="true" className={`h-[9px] w-[9px] rounded-full ${MOTION_DOT[m]}`} />
                {MOTION_LABELS[m]}
              </span>
              <span className="mt-1 block text-[28px] leading-[1.2] font-medium tabular-nums">{count(counts[m])}</span>
              <span className="mt-0.5 block text-sm font-semibold text-brand group-hover:text-brand-hover">See the list</span>
            </Link>
          ))}
        </div>

        <h2 className="mt-10 mb-0 text-base font-semibold">Up next</h2>
        <div className="mt-3.5 grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-2">
          {QUEUES.filter((q) => counts[q.motion] > 0).map((q) => {
            const rows = run.companies.filter((c) => c.motion === q.motion).slice(0, UP_NEXT_SIZE);
            return (
              <section key={q.motion} aria-labelledby={`q-${q.motion}`} className="min-w-0 border-t border-line pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 id={`q-${q.motion}`} className="m-0 text-[15px] font-semibold">
                    {q.title}
                  </h3>
                  <MotionPill motion={q.motion} />
                </div>
                <ul className="mt-2 mb-0 list-none p-0">
                  {rows.map((c) => (
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
                      {q.personalPage && (
                        <Link href={`/p/${c.id}`} className="hidden text-sm font-semibold no-underline sm:inline">
                          Personal page
                        </Link>
                      )}
                      <span className="w-[76px] flex-none text-right font-semibold tabular-nums">{money(c.estimate.acv)}</span>
                    </li>
                  ))}
                </ul>
                {counts[q.motion] > rows.length && (
                  <Link href={`/leads?motion=${q.motion}`} className="mt-1 inline-flex min-h-11 items-center text-[15px] font-semibold no-underline">
                    See all {count(counts[q.motion])}
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
