import Link from "next/link";
import { Logo } from "./Logo";

const LINKS: Array<{ label: string; href: "/how-it-works" | "/pricing" }> = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
];

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto flex min-h-16 w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-8 py-3">
        <span className="flex items-center gap-2 text-sm text-muted">
          <Logo size={20} />
          ACV Router by GoToSpook
        </span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center px-3 text-[15px] font-medium text-muted no-underline hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
