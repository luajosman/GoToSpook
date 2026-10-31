"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native <dialog> with the app's look: white panel, thin rule, radius 10px. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLElement>("input:not([type=radio]), textarea")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(640px,calc(100vw-32px))] rounded-[10px] border border-line bg-white p-0 text-ink shadow-[0_12px_40px_rgba(18,24,38,0.18)] backdrop:bg-[rgba(18,24,38,0.35)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 id="dialog-title" className="m-0 text-base font-semibold">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-xl text-muted hover:bg-track">
          ×
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok" | "info"; children: ReactNode }) {
  const cls = tone === "error" ? "bg-amber-tint text-amber-text" : tone === "ok" ? "bg-brand-tint text-brand-text" : "bg-panel text-ink-soft";
  return <div className={`mt-3 rounded-[10px] px-3.5 py-3 text-[15px] ${cls}`}>{children}</div>;
}

export const INPUT =
  "min-h-11 w-full rounded-[10px] border border-line-strong bg-white px-3.5 text-base text-ink placeholder:text-faint focus:border-brand focus:outline-none";
export const PRIMARY =
  "inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50";
export const SECONDARY =
  "inline-flex min-h-11 items-center rounded-[10px] border border-line-strong bg-white px-3.5 text-[15px] font-medium text-ink hover:bg-track disabled:cursor-not-allowed disabled:opacity-50";
