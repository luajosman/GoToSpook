"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { postOutreach } from "./api";
import { Dialog, INPUT, Notice, PRIMARY, SECONDARY } from "./Dialog";

export function CallDialog({ open, onClose, companyId, companyName, phone }: { open: boolean; onClose: () => void; companyId: string; companyName: string; phone?: string }) {
  const router = useRouter();
  const [to, setTo] = useState(phone ?? "");
  const [contactName, setContactName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  async function start(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postOutreach("/api/outreach/call", { op: "start", companyId, to, contactName });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setStarted(true);
    router.refresh();
  }

  function close() {
    setStarted(false);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} title={`AI call · ${companyName}`}>
      {started ? (
        <>
          <Notice tone="ok">The call is starting. It appears under Outreach on this lead; open it there for the transcript once the call has ended.</Notice>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={close} className={SECONDARY}>
              Close
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={start}>
          <Notice tone="info">
            An AI agent calls in English. It says up front that it is an AI and that the call is recorded and transcribed, and it ends the call if
            the person objects or is not interested.
          </Notice>
          <label htmlFor="call-to" className="mt-4 block text-[15px] font-semibold">
            Phone number
          </label>
          <input autoFocus id="call-to" type="tel" inputMode="tel" className={`mt-1.5 ${INPUT}`} value={to} onChange={(e) => setTo(e.target.value)} placeholder="+49 30 1234567" />
          <label htmlFor="call-contact" className="mt-3 block text-[15px] font-semibold">
            Ask for <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="call-contact" className={`mt-1.5 ${INPUT}`} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="the owner or managing director" />
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={close} className={SECONDARY}>
              Cancel
            </button>
            <button type="submit" disabled={busy || to.trim().length < 6} className={PRIMARY}>
              {busy ? "Starting …" : "Start the call"}
            </button>
          </div>
        </form>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Dialog>
  );
}
