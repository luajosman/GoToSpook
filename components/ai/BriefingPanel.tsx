"use client";

import type { Briefing } from "@/lib/ai/briefing";
import { AI_PRIMARY, AI_SECONDARY, AiError, AiNote, CopyButton, Sparkle } from "./AiParts";
import { useAi } from "./useAi";

type Result = { value: Briefing; generatedAt: string };

export function BriefingPanel({ companyId, initial }: { companyId: string; initial: Result | null }) {
  const { state, run } = useAi<Result>("/api/ai/briefing", initial);
  const loading = state.kind === "loading";

  return (
    <section aria-labelledby="briefing-heading" className="border-t border-line py-[22px]">
      <div className="flex items-center justify-between gap-3">
        <h2 id="briefing-heading" className="m-0 flex items-center gap-2 text-base font-semibold">
          <Sparkle />
          Briefing
        </h2>
        {state.kind === "done" && (
          <button type="button" onClick={() => run({ companyId, refresh: true })} className="min-h-9 px-1 text-sm font-semibold text-ink">
            Rewrite
          </button>
        )}
      </div>

      {state.kind !== "done" && (
        <>
          <p className="mt-1 mb-0 text-[15px] text-muted">Why to contact them now, talking points and a German opening line, from the evidence.</p>
          <button type="button" onClick={() => run({ companyId })} disabled={loading} className={`mt-3 ${AI_PRIMARY}`}>
            {loading ? "Writing …" : "Write briefing"}
          </button>
        </>
      )}

      {state.kind === "error" && <AiError message={state.message} notConfigured={state.notConfigured} />}

      {state.kind === "done" && (
        <div className={loading ? "opacity-50" : ""}>
          <h3 className="mt-3 mb-0 text-sm font-semibold text-muted">Why now</h3>
          <p className="mt-1 mb-0 text-[15px] text-ink-soft">{state.data.value.whyNow}</p>
          <h3 className="mt-4 mb-0 text-sm font-semibold text-muted">Talking points</h3>
          <ul className="mt-1 mb-0 list-disc pl-5 text-[15px] text-ink-soft">
            {state.data.value.talkingPoints.map((point) => (
              <li key={point} className="mb-1">
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3">
            <h3 className="m-0 text-sm font-semibold text-muted">Opening line, in German</h3>
            <CopyButton text={state.data.value.openingLineDe} />
          </div>
          <blockquote lang="de" className="mt-1.5 mb-0 rounded-[10px] bg-panel px-3.5 py-3 text-[15px] leading-[1.55]">
            {state.data.value.openingLineDe}
          </blockquote>
          <h3 className="mt-4 mb-0 text-sm font-semibold text-muted">Watch out</h3>
          <p className="mt-1 mb-0 text-[15px] text-ink-soft">{state.data.value.watchOut}</p>
          <AiNote generatedAt={state.data.generatedAt} />
        </div>
      )}
      {state.kind === "loading" && initial === null && <p className="mt-2 mb-0 text-sm text-muted">Reading the evidence …</p>}
      {state.kind === "error" && initial !== null && (
        <button type="button" onClick={() => run({ companyId })} className={`mt-3 ${AI_SECONDARY}`}>
          Try again
        </button>
      )}
    </section>
  );
}
