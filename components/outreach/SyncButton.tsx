"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postOutreach } from "./api";

/** Asks the server to pull fresh data from a provider (call transcript, Needle events), then re-renders the lead. */
export function SyncButton({ url, body, label }: { url: string; body: Record<string, unknown>; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await postOutreach(url, body);
          setBusy(false);
          if (res.ok) router.refresh();
          else setError(res.message);
        }}
        className="min-h-9 text-sm font-semibold text-ink disabled:text-faint"
      >
        {busy ? "Loading …" : label}
      </button>
      {error && <span className="text-sm text-amber-text">{error}</span>}
    </span>
  );
}
