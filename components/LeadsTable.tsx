import Link from "next/link";
import { MOTION_BAR, MOTION_DOT, MotionPill } from "@/components/MotionPill";
import type { LoadedRun } from "@/lib/data";
import { countByMotion } from "@/lib/data";
import { count, initialsOf, money, moneyK } from "@/lib/format";
import { MOTION_LABELS } from "@/lib/score/motion";
import type { Confidence, Motion, ScoredCompany } from "@/lib/types";

export type MotionFilter = Motion | "all";

const FILTERS: MotionFilter[] = ["all", "high_touch", "check", "automated", "welcome"];

const CONFIDENCE: Record<Confidence, string> = { high: "High", medium: "Medium", low: "Low" };

export function parseMotionFilter(value: string | string[] | undefined): MotionFilter {
  const single = Array.isArray(value) ? value[0] : value;
  return FILTERS.includes(single as MotionFilter) ? (single as MotionFilter) : "all";
}

/** End of the ACV scale: at least €18k, otherwise the next €6k step above the biggest ACV. */
export function scaleMaxFor(run: LoadedRun): number {
  const max = Math.max(0, ...run.companies.map((c) => c.estimate.acv));
  return Math.max(18000, Math.ceil(max / 6000) * 6000);
}

function pct(value: number, max: number): string {
  return `${(Math.min(value / max, 1) * 100).toFixed(2)}%`;
}

function driverText(driver: ScoredCompany["estimate"]["technicians"], confidence: Confidence): string {
  if (confidence === "low" && driver.low !== driver.high) return `${driver.low}–${driver.high}`;
  return String(driver.value);
}

function whyText(company: ScoredCompany): string {
  const first = company.estimate.technicians.evidence[0];
  return first ? first.finding : company.motionReason;
}

const SEG = "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-[15px] no-underline";

export function LeadsTable({ run, motion }: { run: LoadedRun; motion: MotionFilter }) {
  const counts = countByMotion(run);
  const total = run.companies.length;
  const rows = motion === "all" ? run.companies : run.companies.filter((c) => c.motion === motion);
  const max = scaleMaxFor(run);
  const thresholdPct = pct(run.threshold, max);
  const laneTotal = motion === "all" ? total : counts[motion];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="leads-heading" className="m-0 text-base font-semibold">
            Leads by predicted ACV
          </h2>
          <p className="mt-0.5 mb-0 text-[15px] text-muted">
            The dark mark on each bar is your {money(run.threshold)} threshold.
          </p>
        </div>
        <nav aria-label="Filter by motion" className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-line bg-track p-[3px]">
          {FILTERS.map((f) => {
            const on = f === motion;
            const n = f === "all" ? total : counts[f];
            const href = f === "all" ? "/leads" : `/leads?motion=${f}`;
            return (
              <Link
                key={f}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`${SEG} ${on ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(18,24,38,0.10)] hover:text-ink" : "font-medium text-muted hover:text-ink"}`}
              >
                {f === "all" ? "All" : MOTION_LABELS[f]}
                <span className="font-medium text-muted tabular-nums">{count(n)}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[1064px]">
          <div className="grid grid-cols-[minmax(240px,2.2fr)_90px_90px_250px_96px_108px_minmax(170px,2fr)] items-end gap-3 border-b border-line py-2.5 text-[13px] font-semibold text-muted">
            <span>Company</span>
            <span className="text-right">Field techs</span>
            <span className="text-right">Office seats</span>
            <span>
              <span className="block">Predicted ACV</span>
              <span aria-hidden="true" className="mt-1 flex gap-2.5 text-xs font-medium">
                <span className="w-[76px] flex-none" />
                <span className="relative h-4 w-40 flex-none">
                  <span className="absolute left-0">€0</span>
                  <span className="absolute -translate-x-1/2 font-semibold text-ink" style={{ left: thresholdPct }}>
                    {moneyK(run.threshold)}
                  </span>
                  <span className="absolute right-0">{moneyK(max)}</span>
                </span>
              </span>
            </span>
            <span>Confidence</span>
            <span>Motion</span>
            <span>Why</span>
          </div>

          {rows.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[minmax(240px,2.2fr)_90px_90px_250px_96px_108px_minmax(170px,2fr)] items-center gap-3 border-b border-line-soft py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="inline-flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-track text-[13px] font-semibold text-muted">
                  {initialsOf(c.name)}
                </span>
                <span className="min-w-0">
                  <Link href={`/leads/${c.id}`} className="block font-semibold text-ink no-underline hover:text-ink">
                    {c.name}
                  </Link>
                  <span className="block text-sm text-muted">{c.address.city}</span>
                </span>
              </span>
              <span className="text-right font-semibold tabular-nums">{driverText(c.estimate.technicians, c.estimate.confidence)}</span>
              <span className="text-right tabular-nums">{driverText(c.estimate.officeSeats, c.estimate.confidence)}</span>
              <span className="flex items-center gap-2.5">
                <span className="w-[76px] flex-none text-right font-semibold tabular-nums">{money(c.estimate.acv)}</span>
                <span aria-hidden="true" className="relative h-2 w-40 flex-none rounded-full bg-line-soft">
                  <span className={`absolute inset-y-0 left-0 rounded-full ${MOTION_BAR[c.motion]}`} style={{ width: pct(c.estimate.acv, max) }} />
                  <span className="absolute -top-[5px] -bottom-[5px] w-0.5 -ml-px rounded-[1px] bg-mark" style={{ left: thresholdPct }} />
                </span>
              </span>
              <span className="text-[15px]">{CONFIDENCE[c.estimate.confidence]}</span>
              <span>
                <MotionPill motion={c.motion} />
              </span>
              <span className="text-sm text-muted">{whyText(c)}</span>
            </div>
          ))}
          {rows.length === 0 && <p className="m-0 py-6 text-[15px] text-muted">No leads in this motion.</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1.5">
        <span className="text-sm text-muted">
          Showing {count(rows.length)} of {count(laneTotal)} leads
        </span>
        <span aria-hidden="true" className="inline-flex h-2 w-2 rounded-full">
          <span className={`h-2 w-2 rounded-full ${motion === "all" ? "bg-line-soft" : MOTION_DOT[motion]}`} />
        </span>
      </div>
    </>
  );
}
