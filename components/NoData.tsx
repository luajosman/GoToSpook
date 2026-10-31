import type { LoadedRun } from "@/lib/data";

/** Pill next to a page title while there is no scored run. */
export function NoDataBadge({ run }: { run: LoadedRun }) {
  if (run.origin !== "empty") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-tint px-2.5 py-[3px] text-[13px] font-semibold text-amber-text">
      No data yet
    </span>
  );
}

/** Explains how to fill the app, shown on the Overview while there is no scored run. */
export function NoDataNotice({ run }: { run: LoadedRun }) {
  if (run.origin !== "empty") return null;
  return (
    <div className="mt-6 max-w-[860px] rounded-[10px] bg-panel px-5 py-[18px]">
      <p className="m-0 font-semibold">{run.problem ? "The latest results file could not be read." : "No companies scored yet."}</p>
      <p className="mt-1.5 mb-0 text-[15px] text-ink-soft">
        {run.problem
          ? run.problem
          : "Companies come from the Lusha company search. Add LUSHA_API_KEY to .env.local, then run the pipeline once or keep it running:"}
      </p>
      <pre className="mt-3 mb-0 overflow-x-auto rounded-lg bg-white px-3 py-2 text-[13px] leading-relaxed text-ink">
        npm run pipeline{"\n"}npm run pipeline:watch
      </pre>
    </div>
  );
}
