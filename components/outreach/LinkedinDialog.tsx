"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { postOutreach } from "./api";
import { Dialog, INPUT, Notice, PRIMARY, SECONDARY } from "./Dialog";

type Person = { identity: string; name: string; headline: string; location: string; profileUrl: string; degree: string };
type Campaign = { id: string; name: string; status: string };

const URL = "/api/outreach/linkedin";

export function LinkedinDialog({ open, onClose, companyId, companyName }: { open: boolean; onClose: () => void; companyId: string; companyName: string }) {
  const router = useRouter();
  const [keywords, setKeywords] = useState(companyName);
  const [title, setTitle] = useState("Geschäftsführer");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState<"search" | "enroll" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void postOutreach<Campaign>(URL, { op: "campaign", companyId }).then((res) => {
      if (!alive) return;
      if (res.ok) setCampaign(res.data);
      else setError(res.message);
    });
    return () => {
      alive = false;
    };
  }, [companyId]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy("search");
    setError(null);
    const res = await postOutreach<Person[]>(URL, { op: "search", companyId, keywords, title });
    setBusy(null);
    if (res.ok) setPeople(res.data);
    else setError(res.message);
  }

  async function enroll() {
    if (!person) return;
    setBusy("enroll");
    setError(null);
    const res = await postOutreach(URL, { op: "enroll", companyId, person });
    setBusy(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setDone(true);
    router.refresh();
  }

  function close() {
    setDone(false);
    setError(null);
    onClose();
  }

  const draft = campaign && campaign.status !== "active";

  return (
    <Dialog open={open} onClose={close} title={`LinkedIn via Needle · ${companyName}`}>
      {campaign && (
        <p className="mt-0 mb-3 text-sm text-muted">
          Campaign <span className="font-semibold text-ink">{campaign.name}</span> · {campaign.status}
        </p>
      )}
      {done ? (
        <>
          <Notice tone="ok">
            {person?.name} is in the Needle campaign. Needle checks the connection, sends the invitation and the messages on its schedule
            {draft ? " once the campaign is activated in Needle" : ""}. Use “Refresh from Needle” on the lead to see what was sent.
          </Notice>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={close} className={SECONDARY}>
              Close
            </button>
          </div>
        </>
      ) : !person ? (
        <>
          <p className="m-0 text-[15px] text-muted">Find the right person at this company. Needle then writes and sends the messages.</p>
          <form onSubmit={search} className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_180px_auto]">
            <input aria-label="Keywords" className={INPUT} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Company or name" />
            <input aria-label="Job title" className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title" />
            <button type="submit" disabled={busy !== null || keywords.trim().length < 2} className={PRIMARY}>
              {busy === "search" ? "Searching …" : "Search"}
            </button>
          </form>
          {people && people.length === 0 && <Notice tone="info">No people found. Try the owner&rsquo;s name or a shorter company name.</Notice>}
          {people && people.length > 0 && (
            <ul className="mt-3 mb-0 list-none p-0">
              {people.map((p) => (
                <li key={p.identity} className="flex items-center gap-3 border-t border-line-soft py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block truncate text-sm text-muted">{[p.headline, p.location].filter(Boolean).join(" · ")}</span>
                  </span>
                  <a href={p.profileUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold no-underline">
                    Profile
                  </a>
                  <button type="button" onClick={() => setPerson(p)} className={SECONDARY}>
                    Choose
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="m-0">
              <span className="font-semibold">{person.name}</span>
              <span className="block text-sm text-muted">{person.headline}</span>
            </p>
            <button type="button" onClick={() => setPerson(null)} className="text-sm font-semibold text-ink">
              Change
            </button>
          </div>
          <Notice tone="info">
            Needle adds {person.name.split(" ")[0]} as a lead and runs the campaign: it checks the connection, sends an invitation, writes the
            first message with AI and follows up once.
            {draft ? " The campaign is not active yet, so nothing is sent until you activate it in Needle." : ""}
          </Notice>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={close} className={SECONDARY}>
              Cancel
            </button>
            <button type="button" onClick={enroll} disabled={busy !== null || !campaign} className={PRIMARY}>
              {busy === "enroll" ? "Adding …" : "Add to the campaign"}
            </button>
          </div>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Dialog>
  );
}
