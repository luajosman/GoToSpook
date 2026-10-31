import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = { title: "Inbound" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-[1_1_220px] border-t border-line py-[18px]">
      <p className="m-0 text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1 mb-0 text-[28px] leading-[1.2] font-medium tabular-nums">{value}</p>
    </div>
  );
}

const GRID = "grid grid-cols-[72px_minmax(200px,2fr)_190px_96px_minmax(220px,2.4fr)] gap-3";

export default function InboundPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[1280px] px-8 pt-7 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">Inbound, scored live</h1>
            <p className="mt-2 mb-0 max-w-[680px] text-base text-muted">
              Every form fill and Meta lead is scored within seconds and routed while it&rsquo;s still warm.
            </p>
          </div>
          <button
            type="button"
            disabled
            title="No source is connected yet"
            className="inline-flex min-h-12 cursor-default items-center gap-2 rounded-[10px] border border-line bg-track px-5 text-base font-semibold text-muted"
          >
            Connect a source to score live
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <Stat label="Scored today" value="0" />
          <Stat label="Median time to score" value="–" />
          <Stat label="Sent to reps" value="0" />
          <Stat label="Quality signals to Meta" value="0" />
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-5">
          <section aria-labelledby="feed-heading" className="min-w-0 flex-[999_1_640px] border-t border-line pt-[22px] pb-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 id="feed-heading" className="m-0 text-base font-semibold">
                Today
              </h2>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-line-strong" />
                Not connected
              </span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[826px]">
                <div className={`${GRID} border-b border-line py-2 text-[13px] font-semibold text-muted`}>
                  <span>Time</span>
                  <span>Company</span>
                  <span>Predicted ACV</span>
                  <span>Motion</span>
                  <span>What happened</span>
                </div>
                <div className="border-b border-line-soft py-6">
                  <p className="m-0 font-semibold">No inbound leads yet.</p>
                  <p className="mt-1 mb-0 max-w-[640px] text-[15px] text-muted">
                    Form fills and Meta leads appear here once a source is connected. Each one is scored with the same formula and motion
                    rules as the list, and routed within seconds.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
            <section aria-labelledby="next-heading" className="border-t border-line py-[22px]">
              <h2 id="next-heading" className="m-0 flex items-center gap-2.5 text-base font-semibold">
                <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-amber" />
                Call next
              </h2>
              <p className="mt-3 mb-0 font-semibold">Nothing waiting.</p>
              <p className="mt-0.5 mb-0 text-[15px] text-muted">The first lead above the threshold shows up here with its briefing.</p>
            </section>

            <section aria-labelledby="sources-heading" className="border-t border-line py-[22px]">
              <h2 id="sources-heading" className="m-0 text-base font-semibold">
                Sources
              </h2>
              <ul className="mt-2.5 mb-0 list-none p-0 text-[15px]">
                <li className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5">
                  <span>Meta lead ads</span>
                  <span className="font-semibold text-muted">Not connected</span>
                </li>
                <li className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5">
                  <span>Website form</span>
                  <span className="font-semibold text-muted">Not connected</span>
                </li>
              </ul>
              <button type="button" disabled className="inline-flex min-h-11 cursor-default items-center gap-1.5 text-[15px] font-semibold text-faint">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add a source
              </button>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
