import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { PricingSimulator } from "@/components/PricingSimulator";
import { SampleBadge } from "@/components/SampleBadge";
import { loadRun } from "@/lib/data";
import { count, money } from "@/lib/format";
import { toSimulationInput } from "@/lib/score/simulate";

export const metadata: Metadata = { title: "Pricing simulator" };

export default function PricingPage() {
  const run = loadRun();
  const companies = run.companies.map(toSimulationInput);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[1280px] px-8 pt-7 pb-16">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">Pricing simulator</h1>
          {run.origin === "sample" && <SampleBadge />}
        </div>
        <p className="mt-2 mb-0 max-w-[720px] text-base text-muted">
          See how a price change would shift your leads, based on the {count(run.companies.length)} companies in your latest run. The threshold
          stays at {money(run.threshold)} so the numbers compare.
        </p>
        <PricingSimulator companies={companies} threshold={run.threshold} generatedAt={run.generatedAt} />
      </main>
    </>
  );
}
