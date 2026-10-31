"use client";

import type { WelcomeDrafts } from "@/lib/ai/welcome";
import { AI_PRIMARY, AiError, AiNote, CopyButton, Sparkle } from "./AiParts";
import { useAi } from "./useAi";

type Result = { value: WelcomeDrafts; generatedAt: string };

export function WelcomePanel({ companyId, initial }: { companyId: string; initial: Result | null }) {
  const { state, run } = useAi<Result>("/api/ai/welcome", initial);
  const loading = state.kind === "loading";

  return (
    <section aria-labelledby="welcome-heading" className="border-t border-line py-[22px]">
      <div className="flex items-center justify-between gap-3">
        <h2 id="welcome-heading" className="m-0 flex items-center gap-2 text-base font-semibold">
          <Sparkle />
          Welcome drafts
        </h2>
        {state.kind === "done" && (
          <button type="button" onClick={() => run({ companyId, refresh: true })} disabled={loading} className="min-h-9 px-1 text-sm font-semibold text-ink">
            Rewrite
          </button>
        )}
      </div>

      {state.kind !== "done" && (
        <>
          <p className="mt-1 mb-0 text-[15px] text-muted">A congratulations letter and an intro request to a partner, both in German.</p>
          <button type="button" onClick={() => run({ companyId })} disabled={loading} className={`mt-3 ${AI_PRIMARY}`}>
            {loading ? "Writing …" : "Write drafts"}
          </button>
        </>
      )}

      {state.kind === "error" && <AiError message={state.message} notConfigured={state.notConfigured} />}

      {state.kind === "done" && (
        <div className={loading ? "opacity-50" : ""}>
          <div className="mt-3 flex items-center justify-between gap-3">
            <h3 className="m-0 text-sm font-semibold text-muted">Congratulations letter</h3>
            <CopyButton text={`${state.data.value.letterSubjectDe}\n\n${state.data.value.letterBodyDe}`} />
          </div>
          <div lang="de" className="mt-1.5 rounded-[10px] bg-panel px-3.5 py-3 text-[15px] leading-[1.55]">
            <p className="m-0 font-semibold">{state.data.value.letterSubjectDe}</p>
            <p className="mt-2 mb-0 whitespace-pre-line">{state.data.value.letterBodyDe}</p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <h3 className="m-0 text-sm font-semibold text-muted">Intro request to a partner</h3>
            <CopyButton text={state.data.value.introRequestDe} />
          </div>
          <blockquote lang="de" className="mt-1.5 mb-0 whitespace-pre-line rounded-[10px] bg-panel px-3.5 py-3 text-[15px] leading-[1.55]">
            {state.data.value.introRequestDe}
          </blockquote>
          <AiNote generatedAt={state.data.generatedAt} />
        </div>
      )}
    </section>
  );
}
