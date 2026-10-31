import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = { title: "Customers" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-[1_1_200px] border-t border-line py-[18px]">
      <p className="m-0 text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1 mb-0 text-[28px] leading-[1.2] font-medium tabular-nums">{value}</p>
    </div>
  );
}

const SEG = "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-[15px]";

export default function CustomersPage() {
  return (
    <>
      <AppHeader current="customers" />
      <main className="mx-auto w-full max-w-[1280px] px-8 pt-7 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">Customers who are growing</h1>
            <p className="mt-2 mb-0 max-w-[720px] text-base text-muted">
              The signals that size a lead also show when a customer is about to need more licenses. Your account manager hears about it
              first.
            </p>
          </div>
          <div aria-label="Which customers to show" className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-track p-[3px]">
            <span aria-current="true" className={`${SEG} bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(18,24,38,0.10)]`}>
              Growing<span className="font-medium text-muted tabular-nums">0</span>
            </span>
            <span className={`${SEG} font-medium text-muted`}>
              All customers<span className="font-medium text-muted tabular-nums">0</span>
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <Stat label="Customers watched" value="0" />
          <Stat label="Showing growth" value="0" />
          <Stat label="Possible added ACV" value="€0" />
          <Stat label="Upsell tasks created" value="0" />
        </div>

        <section aria-labelledby="empty-heading" className="mt-5 border-t border-line pt-[22px]">
          <div className="max-w-[760px] rounded-[10px] bg-panel px-5 py-[18px]">
            <h2 id="empty-heading" className="m-0 text-base font-semibold">
              No customer list yet.
            </h2>
            <p className="mt-1.5 mb-0 text-[15px] text-ink-soft">
              Once your customers are listed, the same public signals that size a lead (team pages, job ads, new locations) show which of
              them have outgrown their licenses, with the added ACV and a suggested message for the account manager.
            </p>
            <p className="mt-3 mb-0 text-[15px] text-muted">
              To feed it: a customer file under <code className="rounded bg-white px-1 text-[14px]">data/</code> with name, zip, licensed
              technicians and office seats, read the same way as the scored run. Nothing is stored in the repo.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
