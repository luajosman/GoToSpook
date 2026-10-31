"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postOutreach } from "./api";

export function SyncCallButton({ companyId, eventId, label }: { companyId: string; eventId: string; label: string }) {
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
          const res = await postOutreach("/api/outreach/call", { op: "sync", companyId, eventId });
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
