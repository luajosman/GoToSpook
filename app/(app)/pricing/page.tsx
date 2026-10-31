import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { PricingSimulator } from "@/components/PricingSimulator";
import { NoDataBadge, NoDataNotice } from "@/components/NoData";
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
          <NoDataBadge run={run} />
        </div>
        <p className="mt-2 mb-0 max-w-[720px] text-base text-muted">
          {run.origin === "empty"
            ? "See how a price change would shift your leads, once the pipeline has scored companies."
            : `See how a price change would shift your leads, based on the ${count(run.companies.length)} companies in your latest run. The threshold stays at ${money(run.threshold)} so the numbers compare.`}
        </p>
        {run.origin === "empty" ? (
          <NoDataNotice run={run} />
        ) : (
          <PricingSimulator companies={companies} threshold={run.threshold} generatedAt={run.generatedAt} />
        )}
      </main>
    </>
  );
}
