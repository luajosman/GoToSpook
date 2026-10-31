"use client";

import { useMemo, useState } from "react";
import { MOTION_DOT, MotionPill } from "@/components/MotionPill";
import { count, money } from "@/lib/format";
import { CURRENT_PRICING, pricingFormulaText, type Pricing } from "@/lib/score/formula";
import { MOTION_LABELS } from "@/lib/score/motion";
import { DEFAULT_STARTER, simulate, type SimulationInput } from "@/lib/score/simulate";
import type { Motion } from "@/lib/types";

const MOTIONS: Motion[] = ["high_touch", "check", "automated", "welcome"];

const STEP_BTN =
  "h-11 w-11 rounded-[10px] border border-line-strong bg-white text-xl text-ink hover:bg-track disabled:cursor-not-allowed disabled:opacity-40";

function Stepper({
  label,
  note,
  value,
  min,
  onChange,
  step,
}: {
  label: string;
  note: string;
  value: number;
  min: number;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[10px] bg-panel px-3 py-2.5">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-muted">{note}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <button type="button" aria-label={`Lower ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} className={STEP_BTN}>
          −
        </button>
        <output aria-live="polite" className="min-w-16 text-center text-base font-semibold tabular-nums">
          {money(value)}
        </output>
        <button type="button" aria-label={`Raise ${label.toLowerCase()}`} onClick={() => onChange(value + step)} className={STEP_BTN}>
          +
        </button>
      </span>
    </div>
  );
}

function delta(next: number, current: number): { text: string; strong: boolean } {
  const d = next - current;
  if (d === 0) return { text: "no change", strong: false };
  return { text: d > 0 ? `+${d}` : `−${Math.abs(d)}`, strong: true };
}

function Stat({ label, value, note }: { label: string; value: string; note: React.ReactNode }) {
  return (
    <div className="flex-[1_1_200px] border-t border-line py-[18px]">
      <p className="m-0 text-[13px] font-medium text-muted">{label}</p>
      <p aria-live="polite" className="mt-1 mb-0 text-[28px] leading-[1.2] font-medium tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 mb-0 text-[15px] text-muted">{note}</p>
    </div>
  );
}

export function PricingSimulator({ companies, threshold, generatedAt }: { companies: SimulationInput[]; threshold: number; generatedAt: string }) {
  const [base, setBase] = useState<number>(CURRENT_PRICING.basePerMonth);
  const [seat, setSeat] = useState<number>(CURRENT_PRICING.perExtraOfficeSeat);
  const [tech, setTech] = useState<number>(CURRENT_PRICING.perTechnician);
  const [starter, setStarter] = useState(false);

  const result = useMemo(() => {
    const pricing: Pricing = { ...CURRENT_PRICING, basePerMonth: base, perExtraOfficeSeat: seat, perTechnician: tech };
    return simulate(companies, pricing, { threshold, now: new Date(generatedAt), starter: starter ? DEFAULT_STARTER : null });
  }, [companies, base, seat, tech, starter, threshold, generatedAt]);

  const changed = base !== CURRENT_PRICING.basePerMonth || seat !== CURRENT_PRICING.perExtraOfficeSeat || tech !== CURRENT_PRICING.perTechnician || starter;
  const above = delta(result.above.next.count, result.above.current.count);
  const maxBucket = Math.max(1, ...result.buckets.flatMap((b) => [b.current, b.next]));
  const barWidth = (n: number) => `${((n / maxBucket) * 85).toFixed(2)}%`;

  function reset() {
    setBase(CURRENT_PRICING.basePerMonth);
    setSeat(CURRENT_PRICING.perExtraOfficeSeat);
    setTech(CURRENT_PRICING.perTechnician);
    setStarter(false);
  }

  return (
    <div className="mt-6 flex flex-wrap items-start gap-6">
      <section aria-labelledby="controls-heading" className="min-w-0 flex-[1_1_340px] border-t border-line py-[22px]">
        <div className="flex items-center justify-between gap-3">
          <h2 id="controls-heading" className="m-0 text-base font-semibold">
            New pricing
          </h2>
          <button type="button" onClick={reset} disabled={!changed} className="min-h-11 px-1 text-[15px] font-semibold text-ink disabled:cursor-default disabled:text-faint">
            Reset
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          <Stepper label="First office seat" note={`per month, now ${money(CURRENT_PRICING.basePerMonth)}`} value={base} min={25} step={25} onChange={setBase} />
          <Stepper label="Each extra office seat" note={`per month, now ${money(CURRENT_PRICING.perExtraOfficeSeat)}`} value={seat} min={0} step={25} onChange={setSeat} />
          <Stepper label="Per field technician" note={`per month, now ${money(CURRENT_PRICING.perTechnician)}`} value={tech} min={0} step={5} onChange={setTech} />
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[10px] border border-line p-3">
          <input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-brand" />
          <span>
            <span className="block font-semibold">Add a starter plan</span>
            <span className="block text-[15px] text-muted">
              {money(DEFAULT_STARTER.monthly)} a month for companies with up to {DEFAULT_STARTER.maxTechnicians} technicians, sold self-serve only.
            </span>
          </span>
        </label>
        <p className="mt-4 mb-0 text-[15px] tabular-nums">
          <span className="text-muted">Formula: </span>
          {pricingFormulaText({ ...CURRENT_PRICING, basePerMonth: base, perExtraOfficeSeat: seat, perTechnician: tech })}
        </p>
      </section>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <div className="flex flex-wrap gap-4">
          <Stat
            label="Leads above threshold"
            value={count(result.above.next.count)}
            note={
              <>
                now {count(result.above.current.count)}, <span className={above.strong ? "font-semibold text-ink" : ""}>{above.text}</span>
              </>
            }
          />
          <Stat label="Their combined ACV" value={money(result.above.next.acv)} note={`now ${money(result.above.current.acv)}`} />
          <Stat label="Smallest customer pays" value={money(result.smallest.next)} note={`a year, now ${money(result.smallest.current)}`} />
        </div>

        <section aria-labelledby="dist-heading" className="border-t border-line py-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 id="dist-heading" className="m-0 text-base font-semibold">
              Companies by predicted ACV
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-3 w-3 rounded-[3px] bg-line-strong" />
                Current pricing
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-3 w-3 rounded-[3px] bg-brand" />
                New pricing
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-[18px]">
            {result.buckets.map((b) => (
              <div key={b.label} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex-[0_0_150px] font-semibold tabular-nums">{b.label}</span>
                <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="block h-3 min-w-1 rounded-full bg-line-strong" style={{ width: barWidth(b.current) }} />
                    <span className="text-sm text-muted tabular-nums">{b.current}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="block h-3 min-w-1 rounded-full bg-brand" style={{ width: barWidth(b.next) }} />
                    <span className="text-sm font-semibold tabular-nums">{b.next}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-[18px] mb-0 text-sm text-muted">
            Threshold fixed at {money(threshold)}.
          </p>
        </section>

        <section aria-labelledby="motions-heading" className="border-t border-line py-[22px]">
          <h2 id="motions-heading" className="m-0 text-base font-semibold">
            Motions at the new prices
          </h2>
          <div className="mt-2 flex flex-wrap gap-4">
            {MOTIONS.map((m) => {
              const d = delta(result.motionCounts.next[m], result.motionCounts.current[m]);
              return (
                <div key={m} className="flex-[1_1_160px] border-t border-line-soft pt-3">
                  <p className="m-0 flex items-center gap-2 text-[13px] font-medium text-muted">
                    <span aria-hidden="true" className={`h-[9px] w-[9px] rounded-full ${MOTION_DOT[m]}`} />
                    {MOTION_LABELS[m]}
                  </p>
                  <p aria-live="polite" className="mt-1 mb-0 text-[28px] leading-[1.2] font-medium tabular-nums">
                    {count(result.motionCounts.next[m])}
                  </p>
                  <p className="mt-0.5 mb-0 text-[15px] text-muted">
                    now {count(result.motionCounts.current[m])}, <span className={d.strong ? "font-semibold text-ink" : ""}>{d.text}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="moves-heading" className="border-t border-line py-[22px]">
          <h2 id="moves-heading" className="m-0 text-base font-semibold">
            Who moves
          </h2>
          {result.moves.length === 0 ? (
            <p className="mt-2 mb-0 text-[15px] text-muted">No company changes motion at these prices.</p>
          ) : (
            <ul className="mt-2 mb-0 list-none p-0">
              {result.moves.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft py-3">
                  <span className="min-w-0 flex-[1_1_240px] font-semibold">{c.name}</span>
                  <span className="inline-flex items-center gap-2">
                    <MotionPill motion={c.currentMotion} />
                    <span aria-hidden="true" className="text-muted">
                      →
                    </span>
                    <MotionPill motion={c.newMotion} />
                  </span>
                  <span className="flex-[0_0_200px] text-right text-[15px] tabular-nums">
                    <span className="text-muted">{money(c.currentAcv)}</span> <span className="font-semibold">→ {money(c.newAcv)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
