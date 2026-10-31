"use client";

import { useState } from "react";
import { CallDialog } from "./CallDialog";
import { LinkedinIcon, PhoneIcon } from "./icons";
import { LinkedinDialog } from "./LinkedinDialog";

const ICON_BTN =
  "inline-flex h-12 w-12 items-center justify-center rounded-[10px] border border-line-strong bg-white text-ink hover:bg-track";

export function OutreachButtons({ companyId, companyName, phone, defaultCallTo }: { companyId: string; companyName: string; phone?: string; defaultCallTo?: string }) {
  const [open, setOpen] = useState<"linkedin" | "call" | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen("linkedin")} aria-label="LinkedIn outreach" title="LinkedIn outreach" className={`${ICON_BTN} text-[#0A66C2]`}>
        <LinkedinIcon size={20} />
      </button>
      <button type="button" onClick={() => setOpen("call")} aria-label="AI call" title="AI call" className={ICON_BTN}>
        <PhoneIcon size={20} />
      </button>
      {open === "linkedin" && <LinkedinDialog open onClose={() => setOpen(null)} companyId={companyId} companyName={companyName} />}
      {open === "call" && <CallDialog open onClose={() => setOpen(null)} companyId={companyId} companyName={companyName} phone={phone} defaultCallTo={defaultCallTo} />}
    </>
  );
}
