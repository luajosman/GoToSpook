"use client";

import { useState, type FormEvent } from "react";

type Outcome =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; message: string }
  | { kind: "error"; message: string; detail?: string };

type ApiResponse = {
  status: string;
  message?: string;
  issues?: string[];
  missing?: string[];
  result?: { id: string };
};

const INPUT =
  "min-h-12 w-full rounded-[10px] border border-line-strong bg-white px-3.5 text-base text-ink placeholder:text-faint focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand";

export function FaxForm({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [faxNumber, setFaxNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOutcome({ kind: "sending" });
    try {
      const response = await fetch("/api/fax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, faxNumber, consent }),
      });
      const data = (await response.json()) as ApiResponse;
      if (response.ok && data.status === "sent") {
        setOutcome({ kind: "sent", message: "Ihr Angebot ist unterwegs. Das Fax kommt innerhalb der nächsten Minuten an." });
        return;
      }
      const detail = data.status === "not_configured" && data.missing ? `Faxxing not configured: ${data.missing.join(", ")} missing.` : undefined;
      setOutcome({ kind: "error", message: data.message ?? "Das hat leider nicht geklappt.", detail });
    } catch {
      setOutcome({ kind: "error", message: "Keine Verbindung zum Server. Bitte versuchen Sie es noch einmal." });
    }
  }

  const sending = outcome.kind === "sending";

  return (
    <form onSubmit={submit} noValidate className="mt-4 max-w-[560px]">
      <label htmlFor="fax-number" className="block text-[15px] font-semibold">
        Ihre Faxnummer
      </label>
      <input
        id="fax-number"
        name="faxNumber"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="030 1234567"
        value={faxNumber}
        onChange={(e) => setFaxNumber(e.target.value)}
        disabled={sending}
        className={`mt-1.5 ${INPUT}`}
        aria-describedby="fax-help"
      />
      <p id="fax-help" className="mt-1.5 mb-0 text-sm text-muted">
        Wir senden das Angebot nur an die Nummer, die Sie hier eingeben.
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={sending}
          className="mt-[3px] h-5 w-5 flex-none accent-brand"
        />
        <span className="text-[15px]">
          Ja, senden Sie das Angebot für {companyName} an diese Faxnummer. Wir faxen nur auf Ihre Anfrage, höchstens einmal
          pro Stunde.
        </span>
      </label>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={sending || !consent || faxNumber.trim().length === 0}
          className="inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-brand px-[22px] text-base font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9V3h12v6" />
            <rect x="3" y="9" width="18" height="10" rx="2" />
            <path d="M8 15h8v6H8z" />
          </svg>
          {sending ? "Wird gesendet …" : "Angebot per Fax senden"}
        </button>
        <span className="text-sm text-muted">Kostenlos und unverbindlich.</span>
      </div>
      <div aria-live="polite" className="mt-4">
        {outcome.kind === "sent" && (
          <p className="m-0 flex items-start gap-2 rounded-[10px] bg-brand-tint px-3.5 py-3 text-[15px] text-brand-text">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-[3px] flex-none">
              <path d="m5 12 5 5L20 7" />
            </svg>
            {outcome.message}
          </p>
        )}
        {outcome.kind === "error" && (
          <div className="rounded-[10px] bg-amber-tint px-3.5 py-3 text-[15px] text-amber-text">
            <p className="m-0">{outcome.message}</p>
            {outcome.detail && <p className="mt-1 mb-0 text-[13px] text-muted">{outcome.detail}</p>}
          </div>
        )}
      </div>
    </form>
  );
}
