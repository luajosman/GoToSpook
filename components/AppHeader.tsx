import Link from "next/link";
import { Logo } from "./Logo";

type Current = "pipeline" | "leads";

const NAV: Array<{ key: Current; label: string; href: "/pipeline" | "/leads" }> = [
  { key: "pipeline", label: "Pipeline", href: "/pipeline" },
  { key: "leads", label: "Leads", href: "/leads" },
];

/** Parts of the design that are not in today's demo: shown, but not linked. */
const PLANNED = ["Inbound", "Alerts", "Customers", "Niches", "Pricing", "Learning"];

const ITEM = "inline-flex min-h-11 items-center px-3 text-[15px] no-underline";

export function AppHeader({ current }: { current?: Current }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-16 w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/pipeline" className="flex min-h-11 items-center gap-2.5 text-ink no-underline hover:text-ink">
            <Logo />
            <span className="text-lg font-semibold tracking-[-0.01em]">ACV Router</span>
          </Link>
          <nav aria-label="Main" className="flex flex-wrap gap-0.5">
            {NAV.map((item) =>
              item.key === current ? (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current="page"
                  className={`${ITEM} font-semibold text-ink shadow-[inset_0_-2px_0_#0F7B57] hover:text-ink`}
                >
                  {item.label}
                </Link>
              ) : (
                <Link key={item.key} href={item.href} className={`${ITEM} font-medium text-muted hover:text-ink`}>
                  {item.label}
                </Link>
              ),
            )}
            {PLANNED.map((label) => (
              <span key={label} title="Not in today's demo" className={`${ITEM} cursor-default font-medium text-faint`}>
                {label}
              </span>
            ))}
          </nav>
        </div>
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-white text-muted"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </span>
      </div>
    </header>
  );
}
