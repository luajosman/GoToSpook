"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AI_PRIMARY, AiError, AiNote, Sparkle } from "./AiParts";
import { useAi } from "./useAi";

type Answer = { answer: string; companies: Array<{ id: string; name: string; why: string }>; generatedAt: string };

const EXAMPLES = [
  "Which high-touch accounts are hiring?",
  "Which companies have the weakest evidence?",
  "Who should we call first this week, and why?",
];

export function AskBox() {
  const [question, setQuestion] = useState("");
  const { state, run } = useAi<Answer>("/api/ai/ask");
  const loading = state.kind === "loading";

  function ask(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) return;
    setQuestion(trimmed);
    void run({ question: trimmed });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  return (
    <section aria-labelledby="ask-heading" className="mt-8 border-t border-line pt-6">
      <h2 id="ask-heading" className="m-0 flex items-center gap-2 text-base font-semibold">
        <Sparkle />
        Ask the data
      </h2>
      <form onSubmit={submit} className="mt-3 flex max-w-[860px] flex-wrap gap-3">
        <label htmlFor="ask-input" className="sr-only">
          Your question
        </label>
        <input
          id="ask-input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="Ask about the scored companies"
          className="min-h-11 min-w-0 flex-[1_1_320px] rounded-[10px] border border-line-strong bg-white px-3.5 text-base text-ink placeholder:text-faint focus:border-brand focus:outline-none"
        />
        <button type="submit" disabled={loading || question.trim().length < 3} className={AI_PRIMARY}>
          {loading ? "Thinking …" : "Ask"}
        </button>
      </form>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => ask(example)}
            disabled={loading}
            className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm text-muted hover:border-line-strong hover:text-ink"
          >
            {example}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="max-w-[860px]">
        {state.kind === "error" && <AiError message={state.message} notConfigured={state.notConfigured} />}
        {state.kind === "done" && (
          <div className="mt-4">
            <p className="m-0 text-[15px] text-ink-soft">{state.data.answer}</p>
            {state.data.companies.length > 0 && (
              <ul className="mt-3 mb-0 list-none p-0">
                {state.data.companies.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line-soft py-2.5">
                    <Link href={`/leads/${c.id}`} className="flex-[0_0_280px] font-semibold text-ink no-underline hover:text-ink hover:underline">
                      {c.name}
                    </Link>
                    <span className="min-w-0 flex-[1_1_300px] text-[15px] text-muted">{c.why}</span>
                  </li>
                ))}
              </ul>
            )}
            <AiNote generatedAt={state.data.generatedAt} />
          </div>
        )}
      </div>
    </section>
  );
}
