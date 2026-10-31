import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SampleBadge } from "@/components/SampleBadge";
import { config } from "@/lib/config";
import { countByMotion, loadRun } from "@/lib/data";
import { count, money } from "@/lib/format";
import { pricingFormulaText } from "@/lib/score/formula";
import type { Motion } from "@/lib/types";

export const metadata: Metadata = { title: "Pipeline" };

type Step = { label: string; who: string; person?: boolean };

const MOTIONS: Array<{
  motion: Motion;
  title: string;
  accent: string;
  pill: string;
  pillClass: string;
  description: string;
  countLabel: string;
  ownerLabel: string;
  owner: string;
  steps: Step[];
  link: string;
}> = [
  {
    motion: "high_touch",
    title: "High-touch",
    accent: "border-brand",
    pill: "80% of rep time",
    pillClass: "bg-brand-tint text-brand-text",
    description: "Predicted ACV of {threshold} or more. Every account gets a personal plan and a named owner.",
    countLabel: "Accounts",
    ownerLabel: "Owners",
    owner: config.capacity.repNames.join(", "),
    steps: [
      { label: "Research brief", who: "Auto" },
      { label: "Personal video and call", who: "Person", person: true },
      { label: "Demo with their own data", who: "Person", person: true },
      { label: "Visit on site", who: "Person", person: true },
      { label: "Proposal with ROI for their team", who: "Auto draft, person sends" },
      { label: "White-glove onboarding", who: "Person", person: true },
    ],
    link: "See the high-touch accounts",
  },
  {
    motion: "automated",
    title: "Automated",
    accent: "border-automated",
    pill: "5% of rep time",
    pillClass: "bg-track text-muted",
    description:
      "Established companies below the threshold. They find, try and buy on their own; a rep joins only when they raise a hand.",
    countLabel: "Companies",
    ownerLabel: "Owner",
    owner: "Automation",
    steps: [
      { label: "Local ads in their area and trade", who: "Auto" },
      { label: "Personal letter with a QR code", who: "Auto" },
      { label: "One-pager with their likely price", who: "Auto" },
      { label: "Offer by fax, on request", who: "Auto" },
      { label: "Self-serve trial, already set up", who: "Auto" },
      { label: "Emails after they opt in", who: "Auto" },
      { label: "Weekly group onboarding", who: "Person, one to many", person: true },
    ],
    link: "See the automated companies",
  },
  {
    motion: "welcome",
    title: "Welcome",
    accent: "border-amber",
    pill: "15% of rep time",
    pillClass: "bg-amber-tint text-amber-text",
    description:
      "Companies registered in the last {days} days. Say hello before they’ve picked their tools, ideally through someone they already trust.",
    countLabel: "New this quarter",
    ownerLabel: "Owner",
    owner: "Partnerships",
    steps: [
      { label: "Spot the new registration", who: "Auto" },
      { label: "Congratulations letter and starter offer", who: "Auto" },
      { label: "Warm intro through a partner", who: "Person", person: true },
      { label: "15-minute founder call", who: "Person", person: true },
      { label: "Check-in after six months", who: "Auto" },
    ],
    link: "See the new companies",
  },
];

const MOVES: Array<{ from: string; how: string }> = [
  {
    from: "Automated to High-touch",
    how: "The monthly check pushes the predicted ACV over the threshold, or they raise a hand and turn out bigger than estimated.",
  },
  {
    from: "Welcome to the next motion",
    how: "After six months, by predicted ACV. Fast growers go straight to High-touch.",
  },
  {
    from: "High-touch to Automated",
    how: "A rep confirms the company is smaller than estimated, or there’s no response after three personal touches.",
  },
  {
    from: "Customer to Expansion",
    how: "Growth signals create an upsell task for the account manager.",
  },
];

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex-[1_1_180px] border-t border-line pt-4">
      <p className="m-0 text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1 mb-0 text-[28px] leading-[1.2] font-medium tabular-nums">{value}</p>
      <p className="mt-0.5 mb-0 text-sm text-muted">{note}</p>
    </div>
  );
}

export default function PipelinePage() {
  const run = loadRun();
  const counts = countByMotion(run);
  const threshold = money(run.threshold);
  const band = config.routing.checkBand;
  const { reps, callsPerRep } = config.capacity;

  return (
    <>
      <AppHeader current="pipeline" />
      <main className="mx-auto w-full max-w-[1280px] px-8 pt-8 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">Your GTM pipeline</h1>
              {run.origin === "sample" && <SampleBadge />}
            </div>
            <p className="mt-2 mb-0 max-w-[760px] text-base text-muted">
              Every company gets the motion that fits its value: a personal experience for big accounts, an automatic
              path for small ones, and an early hello for companies that just started.
            </p>
          </div>
          <p className="m-0 text-[15px] text-muted">
            Threshold <span className="font-semibold text-ink tabular-nums">{threshold}</span> ACV, {run.thresholdNote}
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-4">
          <Stat label="Companies scored" value={count(run.companies.length)} note={`in ${run.niche.label}`} />
          <Stat label="High-touch" value={count(counts.high_touch)} note={`at or above ${threshold} ACV`} />
          <Stat label="Automated" value={count(counts.automated)} note="established, below the threshold" />
          <Stat label="Welcome" value={count(counts.welcome)} note={`registered in the last ${config.routing.welcomeDays} days`} />
          <Stat label="Check" value={count(counts.check)} note="low confidence near the threshold" />
        </div>

        <h2 className="mt-10 mb-0 text-base font-semibold">Three motions</h2>
        <div className="mt-3.5 flex flex-wrap items-start gap-6">
          {MOTIONS.map((m) => (
            <section key={m.motion} aria-labelledby={`m-${m.motion}`} className={`min-w-0 flex-[1_1_340px] border-t-[3px] pt-[18px] ${m.accent}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <h3 id={`m-${m.motion}`} className="m-0 text-xl font-semibold">
                  {m.title}
                </h3>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold ${m.pillClass}`}>{m.pill}</span>
              </div>
              <p className="mt-1.5 mb-0 text-[15px] text-muted">
                {m.description.replace("{threshold}", threshold).replace("{days}", String(config.routing.welcomeDays))}
              </p>
              <dl className="mt-3.5 mb-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[15px]">
                <dt className="text-muted">{m.countLabel}</dt>
                <dd className="m-0 text-right font-semibold tabular-nums">{count(counts[m.motion])}</dd>
                <dt className="text-muted">{m.ownerLabel}</dt>
                <dd className="m-0 text-right font-semibold">{m.owner}</dd>
              </dl>
              <ol className="mt-4 mb-0 list-none p-0">
                {m.steps.map((step) => (
                  <li key={step.label} className="flex justify-between gap-3 border-t border-line-soft py-2.5">
                    <span>{step.label}</span>
                    <span className={`text-[13px] font-semibold ${step.person ? "text-brand-text" : "text-muted"}`}>{step.who}</span>
                  </li>
                ))}
              </ol>
              <Link href={`/leads?motion=${m.motion}`} className="mt-1.5 inline-flex min-h-11 items-center text-[15px] font-semibold no-underline">
                {m.link}
              </Link>
            </section>
          ))}
        </div>

        <section aria-labelledby="rules-heading" className="mt-8 border-t border-line pt-6">
          <h2 id="rules-heading" className="m-0 text-base font-semibold">
            Routing rules, in this order
          </h2>
          <p className="mt-1 mb-0 text-[15px] text-muted">
            The model extracts team size from public pages; the code prices it and picks the motion. Nothing is guessed:
            missing data lowers the confidence instead.
          </p>
          <ol className="mt-3 mb-0 list-none p-0">
            {[
              {
                rule: "Welcome",
                how: `Registered in the last ${config.routing.welcomeDays} days, whatever the size.`,
              },
              {
                rule: "Check",
                how: `Low confidence and a predicted ACV within ±${Math.round(band * 100)}% of the threshold (${money(run.threshold * (1 - band))} to ${money(run.threshold * (1 + band))}): a person looks first.`,
              },
              {
                rule: "High-touch",
                how: `Predicted ACV at or above ${threshold}. The threshold is the ACV of company number ${run.callsPerWeek} in the list sorted by ACV (${reps} reps × ${callsPerRep} calls a week), rounded to €${config.capacity.thresholdRounding}.`,
              },
              { rule: "Automated", how: "Everyone else: established companies below the threshold." },
            ].map((r, i) => (
              <li key={r.rule} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line-soft py-3">
                <span className="flex-[0_0_260px] font-semibold tabular-nums">
                  {i + 1}. {r.rule}
                </span>
                <span className="flex-[1_1_360px] text-ink-soft">{r.how}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3.5 mb-0 text-[15px] tabular-nums">
            <span className="text-muted">Pricing: </span>
            {pricingFormulaText()}
          </p>
        </section>

        <section aria-labelledby="moves-heading" className="mt-8 border-t border-line pt-6">
          <h2 id="moves-heading" className="m-0 text-base font-semibold">
            How companies move between motions
          </h2>
          <ul className="mt-3 mb-0 list-none p-0">
            {MOVES.map((mv) => (
              <li key={mv.from} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line-soft py-3">
                <span className="flex-[0_0_260px] font-semibold">{mv.from}</span>
                <span className="flex-[1_1_360px] text-ink-soft">{mv.how}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3.5 mb-0 text-sm text-muted">
            Automated outreach uses ads, letters and email only after opt-in. Cold marketing email stays off for German
            companies, and a fax goes out only when the company asks for it. This is guidance, not legal advice.
          </p>
        </section>
      </main>
    </>
  );
}
