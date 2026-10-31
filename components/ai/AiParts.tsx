"use client";

import { useState } from "react";

export const AI_PRIMARY =
  "inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60";
export const AI_SECONDARY =
  "inline-flex min-h-11 items-center rounded-[10px] border border-line-strong bg-white px-3.5 text-[15px] font-medium text-ink hover:bg-track disabled:cursor-wait disabled:opacity-60";

export function Sparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

export function AiError({ message, notConfigured }: { message: string; notConfigured: boolean }) {
  return (
    <div className="mt-3 rounded-[10px] bg-amber-tint px-3.5 py-3 text-[15px] text-amber-text">
      <p className="m-0">{notConfigured ? "AI is not set up yet." : message}</p>
      {notConfigured && <p className="mt-1 mb-0 text-[13px] text-muted">{message} Restart the dev server after adding them.</p>}
    </div>
  );
}

export function AiNote({ generatedAt }: { generatedAt?: string }) {
  const when = generatedAt ? new Date(generatedAt) : null;
  const text = when && !Number.isNaN(when.getTime())
    ? `Written by AI from the data on ${when.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Check before using.`
    : "Written by AI from the data. Check before using.";
  return <p className="mt-3 mb-0 text-[13px] text-muted">{text}</p>;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex min-h-9 items-center px-1 text-sm font-semibold text-ink"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
