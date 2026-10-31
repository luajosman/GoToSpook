"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { postOutreach } from "./api";
import { Dialog, INPUT, Notice, PRIMARY, SECONDARY } from "./Dialog";

type Person = { identity: string; name: string; headline: string; location: string; profileUrl: string; degree: string };

export function LinkedinDialog({ open, onClose, companyId, companyName }: { open: boolean; onClose: () => void; companyId: string; companyName: string }) {
  const router = useRouter();
  const [keywords, setKeywords] = useState(companyName);
  const [title, setTitle] = useState("Geschäftsführer");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [action, setAction] = useState<"invitation" | "message">("invitation");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"search" | "draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const url = "/api/outreach/linkedin";

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy("search");
    setError(null);
    const res = await postOutreach<Person[]>(url, { op: "search", companyId, keywords, title });
    setBusy(null);
    if (res.ok) setPeople(res.data);
    else setError(res.message);
  }

  async function draft() {
    if (!person) return;
    setBusy("draft");
    setError(null);
    const res = await postOutreach<string>(url, { op: "preview", companyId, identity: person.identity });
    setBusy(null);
    if (res.ok) setText(action === "invitation" ? res.data.slice(0, 300) : res.data);
    else setError(res.message);
  }

  async function send() {
    if (!person) return;
    setBusy("send");
    setError(null);
    const res = await postOutreach(url, { op: "send", companyId, person, action, text });
    setBusy(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSent(true);
    router.refresh();
  }

  function close() {
    setSent(false);
    setError(null);
    onClose();
  }

  const limit = action === "invitation" ? 300 : 3000;

  return (
    <Dialog open={open} onClose={close} title={`LinkedIn outreach · ${companyName}`}>
      {sent ? (
        <>
          <Notice tone="ok">Sent to {person?.name}. The message is saved on this lead.</Notice>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={close} className={SECONDARY}>
              Close
            </button>
          </div>
        </>
      ) : !person ? (
        <>
          <p className="m-0 text-[15px] text-muted">Find the right person at this company, then write to them from the connected LinkedIn account.</p>
          <form onSubmit={search} className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_180px_auto]">
            <input autoFocus aria-label="Keywords" className={INPUT} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Company or name" />
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
                  <button type="button" onClick={() => { setPerson(p); setAction(p.degree === "1" || p.degree === "DISTANCE_1" ? "message" : "invitation"); setText(""); }} className={SECONDARY}>
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
          <fieldset className="mt-4 flex flex-wrap gap-4 border-0 p-0">
            <legend className="sr-only">What to send</legend>
            <label className="flex cursor-pointer items-center gap-2 text-[15px]">
              <input type="radio" name="action" checked={action === "invitation"} onChange={() => setAction("invitation")} className="h-4 w-4 accent-brand" />
              Connection request with note
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[15px]">
              <input type="radio" name="action" checked={action === "message"} onChange={() => setAction("message")} className="h-4 w-4 accent-brand" />
              Message (only to existing connections)
            </label>
          </fieldset>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label htmlFor="li-text" className="text-[15px] font-semibold">
              Message
            </label>
            <button type="button" onClick={draft} disabled={busy !== null} className="text-sm font-semibold text-ink disabled:text-faint">
              {busy === "draft" ? "Drafting …" : "Draft with AI from their profile"}
            </button>
          </div>
          <textarea id="li-text" value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={limit} className={`mt-1.5 py-2.5 ${INPUT}`} placeholder="Guten Tag …" />
          <p className="mt-1 mb-0 text-right text-[13px] text-muted tabular-nums">
            {text.length} / {limit}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={close} className={SECONDARY}>
              Cancel
            </button>
            <button type="button" onClick={send} disabled={busy !== null || text.trim().length === 0} className={PRIMARY}>
              {busy === "send" ? "Sending …" : `Send to ${person.name.split(" ")[0]}`}
            </button>
          </div>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Dialog>
  );
}
