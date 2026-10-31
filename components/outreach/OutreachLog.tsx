import type { OutreachEvent } from "@/lib/outreach/store";
import { LinkedinIcon, PhoneIcon } from "./icons";
import { SyncButton } from "./SyncButton";

const STATUS: Record<OutreachEvent["status"], { label: string; cls: string }> = {
  sent: { label: "Sent", cls: "bg-brand-tint text-brand-text" },
  enrolled: { label: "In campaign", cls: "bg-brand-tint text-brand-text" },
  initiated: { label: "Started", cls: "bg-track text-muted" },
  in_progress: { label: "In progress", cls: "bg-track text-muted" },
  done: { label: "Done", cls: "bg-brand-tint text-brand-text" },
  failed: { label: "Failed", cls: "bg-amber-tint text-amber-text" },
};

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

function duration(secs?: number): string {
  if (secs == null) return "";
  return `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")} min`;
}

export function OutreachLog({ companyId, events }: { companyId: string; events: OutreachEvent[] }) {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section aria-labelledby="outreach-heading" className="border-t border-line py-[22px]">
      <h2 id="outreach-heading" className="m-0 text-base font-semibold">
        Outreach
      </h2>
      {sorted.length === 0 ? (
        <p className="mt-1 mb-0 text-[15px] text-muted">No LinkedIn messages or calls yet. Use the buttons at the top.</p>
      ) : (
        <ul className="mt-2 mb-0 list-none p-0">
          {sorted.map((e) => (
            <li key={e.id} className="border-t border-line-soft py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold">
                  {e.type === "linkedin" ? <span className="text-[#0A66C2]"><LinkedinIcon size={16} /></span> : <PhoneIcon size={16} />}
                  {e.type === "linkedin"
                    ? e.linkedin?.action === "campaign"
                      ? `${e.linkedin.name} added to the Needle campaign`
                      : `${e.linkedin?.action === "invitation" ? "Connection request" : "Message"} to ${e.linkedin?.name}`
                    : `AI call to ${e.call?.to}`}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</span>
              </div>
              <p className="mt-0.5 mb-0 text-sm text-muted">
                {when(e.at)}
                {e.linkedin?.headline ? ` · ${e.linkedin.headline}` : ""}
                {e.call?.contactName ? ` · asked for ${e.call.contactName}` : ""}
                {e.call?.durationSecs != null ? ` · ${duration(e.call.durationSecs)}` : ""}
              </p>
              {e.linkedin?.text && <blockquote className="mt-2 mb-0 whitespace-pre-line rounded-[10px] bg-panel px-3.5 py-2.5 text-[15px]">{e.linkedin.text}</blockquote>}
              {e.needle && (
                <p className="mt-1 mb-0 text-sm text-muted">
                  {e.needle.campaignName ?? "Campaign"} · campaign {e.needle.campaignStatus ?? "unknown"}
                  {e.needle.enrollment ? ` · enrollment ${e.needle.enrollment}` : ""}
                </p>
              )}
              {e.needle?.events && e.needle.events.length > 0 && (
                <ol className="mt-2 mb-0 list-none space-y-2 p-0">
                  {e.needle.events.map((x) => (
                    <li key={x.id} className="rounded-[10px] bg-panel px-3.5 py-2.5 text-[15px]">
                      <span className="block text-[13px] text-muted">
                        {when(x.at)} · {x.label}
                      </span>
                      {x.text && <span className="mt-0.5 block whitespace-pre-line">{x.text}</span>}
                    </li>
                  ))}
                </ol>
              )}
              {e.needle && e.status !== "failed" && (
                <div className="mt-1">
                  <SyncButton url="/api/outreach/linkedin" body={{ op: "sync", companyId, eventId: e.id }} label={e.needle.syncedAt ? `Refresh from Needle (last ${when(e.needle.syncedAt)})` : "Refresh from Needle"} />
                </div>
              )}
              {e.call?.summary && <p className="mt-2 mb-0 text-[15px] text-ink-soft">{e.call.summary}</p>}
              {e.call?.transcript && e.call.transcript.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold">Transcript ({e.call.transcript.length} turns)</summary>
                  <ol className="mt-2 mb-0 list-none space-y-1.5 rounded-[10px] bg-panel p-3 text-[14px]">
                    {e.call.transcript.map((t, i) => (
                      <li key={i}>
                        <span className="font-semibold">{t.role === "agent" ? "Agent" : t.role === "user" ? "Them" : t.role}:</span> {t.message}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {e.error && <p className="mt-2 mb-0 text-sm text-amber-text">{e.error}</p>}
              {e.type === "call" && e.call?.conversationId && e.status !== "done" && e.status !== "failed" && (
                <div className="mt-1">
                  <SyncButton url="/api/outreach/call" body={{ op: "sync", companyId, eventId: e.id }} label="Get status and transcript" />
                </div>
              )}
              {e.type === "call" && e.status === "done" && !e.call?.transcript?.length && e.call?.conversationId && (
                <div className="mt-1">
                  <SyncButton url="/api/outreach/call" body={{ op: "sync", companyId, eventId: e.id }} label="Load transcript" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
